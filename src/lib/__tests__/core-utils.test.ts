import { Writable } from 'node:stream';
import { notFound, redirect } from 'next/navigation';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fail, ok, toActionError, validationError } from '../action-result';
import { DomainError, isDomainError } from '../errors';
import { fingerprint } from '../idempotency';
import { createLogger, getLogContext, runWithLogContext } from '../logger';
import { MoneyError } from '../money';

describe('DomainError', () => {
  it('carries a code, message, field errors and cause', () => {
    const cause = new Error('db down');
    const error = new DomainError('VALIDATION', 'Bad input', {
      fieldErrors: { email: ['Invalid'] },
      cause,
    });
    expect(isDomainError(error)).toBe(true);
    expect(error.code).toBe('VALIDATION');
    expect(error.fieldErrors).toEqual({ email: ['Invalid'] });
    expect(error.cause).toBe(cause);
    expect(new DomainError('NOT_FOUND').message).toBe('NOT_FOUND');
    expect(isDomainError(new Error('x'))).toBe(false);
  });
});

describe('ActionResult', () => {
  it('builds ok and failure results', () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 });
    expect(fail('FORBIDDEN')).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(fail('CONFLICT', 'Taken', { slug: ['in use'] })).toEqual({
      ok: false,
      error: { code: 'CONFLICT', message: 'Taken', fieldErrors: { slug: ['in use'] } },
    });
  });

  it('maps a Zod failure to field errors keyed by path', () => {
    const schema = z.object({ email: z.email(), address: z.object({ city: z.string().min(2) }) });
    const parsed = schema.safeParse({ email: 'nope', address: { city: '' } });
    if (parsed.success) throw new Error('expected failure');
    const result = validationError(parsed.error);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual(['address.city', 'email']);
  });

  it('puts root-level problems under _form', () => {
    const parsed = z.string().safeParse(5);
    if (parsed.success) throw new Error('expected failure');
    const result = validationError(parsed.error);
    expect(result.ok === false && result.error.fieldErrors).toHaveProperty('_form');
  });

  it('translates domain errors into typed results with friendly default messages', () => {
    expect(toActionError(new DomainError('FORBIDDEN'))).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to do that.' },
    });
    expect(toActionError(new DomainError('OUT_OF_STOCK', 'Only 2 left'))).toEqual({
      ok: false,
      error: { code: 'OUT_OF_STOCK', message: 'Only 2 left' },
    });
  });

  it('treats rejected money input as a validation problem', () => {
    const result = toActionError(new MoneyError('INVALID_AMOUNT', 'Not a valid amount: "1,5"'));
    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'Not a valid amount: "1,5"' },
    });
  });

  it('hides unexpected errors behind a generic message', () => {
    const result = toActionError(new Error('connection string postgres://secret'));
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' },
    });
  });

  it('lets Next.js redirect and notFound control flow through', () => {
    expect(() => toActionError(catchThrown(() => redirect('/login')))).toThrow();
    expect(() => toActionError(catchThrown(() => notFound()))).toThrow();
  });
});

function catchThrown(fn: () => never): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the function to throw');
}

describe('fingerprint', () => {
  it('is stable across key order and ignores undefined fields', () => {
    expect(fingerprint({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      fingerprint({ b: { d: [1, 2], c: 2 }, a: 1, skipped: undefined }),
    );
  });

  it('distinguishes different payloads, including bigint amounts and dates', () => {
    expect(fingerprint({ total: 100n })).not.toBe(fingerprint({ total: 101n }));
    expect(fingerprint({ total: 100n })).not.toBe(fingerprint({ total: '100' }));
    expect(fingerprint({ at: new Date('2026-10-01T00:00:00Z') })).not.toBe(
      fingerprint({ at: new Date('2026-10-02T00:00:00Z') }),
    );
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
    expect(fingerprint(null)).toBe(fingerprint(undefined as unknown));
  });
});

describe('logger', () => {
  function capture() {
    const lines: Array<Record<string, unknown>> = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
        done();
      },
    });
    return { lines, logger: createLogger({ level: 'info' }, stream) };
  }

  it('writes structured JSON with the service name', () => {
    const { lines, logger } = capture();
    logger.info({ orderId: 'o1' }, 'order placed');
    expect(lines[0]).toMatchObject({ service: 'auren', orderId: 'o1', msg: 'order placed' });
  });

  it('redacts secrets and personal data', () => {
    const { lines, logger } = capture();
    logger.info(
      {
        password: 'hunter2',
        user: { email: 'a@b.com', phone: '017', token: 't' },
        headers: { cookie: 'c' },
      },
      'sensitive',
    );
    const text = JSON.stringify(lines[0]);
    for (const secret of ['hunter2', 'a@b.com', '017', '"t"']) expect(text).not.toContain(secret);
    expect(text).toContain('[redacted]');
  });

  it('attaches request context to every line inside runWithLogContext', () => {
    const { lines, logger } = capture();
    runWithLogContext({ requestId: 'r1' }, () => {
      runWithLogContext({ userId: 'u1' }, () => {
        logger.info('inside');
        expect(getLogContext()).toEqual({ requestId: 'r1', userId: 'u1' });
      });
    });
    logger.info('outside');
    expect(lines[0]).toMatchObject({ requestId: 'r1', userId: 'u1' });
    expect(lines[1]).not.toHaveProperty('requestId');
  });

  it('serialises bigint money amounts without throwing', () => {
    const { lines, logger } = capture();
    logger.info({ totalMinor: 129900n }, 'amount');
    expect(lines[0]).toMatchObject({ totalMinor: 129900 });
  });

  it('serialises errors', () => {
    const { lines, logger } = capture();
    logger.error({ err: new Error('boom') }, 'failed');
    expect(lines[0]).toMatchObject({ err: { message: 'boom' } });
  });
});
