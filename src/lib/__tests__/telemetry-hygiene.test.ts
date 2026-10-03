import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubMessage } from '../observability/scrub';
import { DomainError } from '../errors';

vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined }));

import { toActionError } from '../action-result';
import { createLogger, serializeError } from '../logger';

const SECRETS = [
  'rahim.uddin@example.com',
  'postgresql://auren_app:s3cretPassw0rd@db.example.com:5432/auren',
  'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signaturesignature',
  '+8801712345678',
  'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
];

describe('message scrubbing', () => {
  it.each(SECRETS)('removes %s', (secret) => {
    const out = scrubMessage(`failed for ${secret} while saving`);
    expect(out).not.toContain(secret);
    expect(out).toContain('failed for');
  });

  it('keeps the connection host but not the credentials', () => {
    const out = scrubMessage('connect ECONNREFUSED postgresql://user:pw@db.example.com:5432/auren');
    expect(out).toContain('postgresql://[redacted]@db.example.com');
    expect(out).not.toContain('pw@');
  });

  it('redacts key=value secrets in any case and quoting', () => {
    for (const text of [
      'password=hunter2',
      'Token: abc123xyz',
      'api_key = "k-123"',
      "secret='s'",
    ]) {
      expect(scrubMessage(text)).toContain('[redacted]');
    }
    expect(scrubMessage('password=hunter2 for order 1234')).not.toContain('hunter2');
  });

  it('replaces database errors entirely, because they quote queries and values', () => {
    const prisma =
      'Invalid `prisma.user.create()` invocation: Unique constraint failed on the fields: (`email`) with email rahim@auren.test';
    expect(scrubMessage(prisma)).toBe('Database error (details removed)');
    expect(scrubMessage('Unique constraint failed on the fields: (`email`)')).toBe(
      'Database error (details removed)',
    );
  });

  it('keeps ordinary text and UUIDs readable', () => {
    expect(scrubMessage('Order 0199f7aa-1b2c-7d3e-8f40-123456789abc not found')).toBe(
      'Order 0199f7aa-1b2c-7d3e-8f40-123456789abc not found',
    );
  });
});

describe('Sentry exception scrubbing', () => {
  it('scrubs exception messages, the event message and breadcrumbs', () => {
    const event = {
      message: 'user rahim@auren.test failed',
      exception: {
        values: [
          { type: 'Error', value: 'cannot reach postgresql://a:b@h:5432/db for +8801712345678' },
        ],
      },
    } as unknown as ErrorEvent;
    const scrubbed = scrubEvent(event);
    const text = JSON.stringify(scrubbed);
    expect(text).not.toContain('rahim@auren.test');
    expect(text).not.toContain('a:b@');
    expect(text).not.toContain('8801712345678');
    expect(scrubBreadcrumb({ category: 'ui', message: 'clicked rahim@auren.test' }).message).toBe(
      'clicked [email]',
    );
  });
});

describe('log error serializer', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      public code: string,
      public meta: Record<string, unknown>,
      public clientVersion = '7.10.0',
    ) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
    }
  }

  it('keeps only the class, code and violated constraint of a Prisma error', () => {
    const error = new PrismaClientKnownRequestError(
      'Invalid `prisma.user.create()` invocation: Unique constraint failed on email rahim@auren.test',
      'P2002',
      { target: ['email'], modelName: 'User', value: 'rahim@auren.test' },
    );
    const out = serializeError(error);
    expect(out).toEqual({
      type: 'PrismaClientKnownRequestError',
      code: 'P2002',
      target: ['email'],
    });
    expect(JSON.stringify(out)).not.toContain('rahim');
  });

  it('scrubs the message and the stack of other errors', () => {
    const error = new Error('smtp login failed for rahim@auren.test password=hunter2');
    const out = serializeError(error);
    expect(JSON.stringify(out)).not.toContain('rahim@auren.test');
    expect(JSON.stringify(out)).not.toContain('hunter2');
    expect(out.type).toBe('Error');
  });

  it('handles values that are not errors', () => {
    expect(serializeError('boom rahim@auren.test')).toEqual({
      type: 'string',
      message: 'boom [email]',
    });
  });

  it('is applied to the err field of every log line', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const log = createLogger({ level: 'error' }, sink);
    log.error(
      { err: new PrismaClientKnownRequestError('quoted query with rahim@auren.test', 'P2025', {}) },
      'save failed',
    );
    log.error({ err: new Error('token=abc123def456 leaked') }, 'other failure');
    const output = lines.join('\n');
    expect(output).not.toContain('rahim@auren.test');
    expect(output).not.toContain('abc123def456');
    expect(output).toContain('P2025');
  });
});

describe('service errors never leak internals to the client', () => {
  const leak = 'select * from users where email = rahim@auren.test; postgresql://u:p@h/db';

  it('turns an unexpected error into a generic message', () => {
    const result = toActionError(new Error(leak));
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' },
    });
    expect(JSON.stringify(result)).not.toContain('rahim');
  });

  it('does not expose the cause or details of a domain error', () => {
    const result = toActionError(
      new DomainError('FORBIDDEN', undefined, { cause: new Error(`staff 7 lacks ${leak}`) }),
    );
    expect(JSON.stringify(result)).not.toContain('rahim');
    expect(JSON.stringify(result)).not.toContain('staff 7');
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('does not surface a driver error with a stack or query text', () => {
    const driver = Object.assign(new Error(leak), { code: '23505', detail: leak, stack: leak });
    const result = JSON.stringify(toActionError(driver));
    expect(result).not.toContain('23505');
    expect(result).not.toContain('select');
  });
});

describe('message scrubbing keeps debugging information', () => {
  it('leaves stack frames, file paths, ISO dates and UUIDs readable', () => {
    const frame = 'at verify (/var/task/src/modules/approvals/service.ts:97:5)';
    expect(scrubMessage(frame)).toBe(frame);
    const line =
      'order 0199f7aa-1b2c-7d3e-8f40-123456789abc created 2026-10-03T10:00:00Z, total 20261003';
    expect(scrubMessage(line)).toBe(line);
    expect(scrubMessage('GET /orders/0199f7aa-1b2c-7d3e-8f40-123456789abc/items')).toContain(
      '0199f7aa-1b2c-7d3e-8f40-123456789abc',
    );
  });

  it.each([
    ['{"password":"hunter2","ok":1}', 'hunter2'],
    ['access_token=abc123 refresh_token=def456', 'abc123'],
    ['client_secret: s3cr3t-value', 's3cr3t-value'],
    ['Authorization: Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    ['cookie: sid=abc; theme=dark', 'abc'],
    ['AUTH_SECRET=short', 'short'],
    ['sessionToken=zzz999', 'zzz999'],
  ])('redacts %s', (text, secret) => {
    expect(scrubMessage(text)).not.toContain(secret);
  });

  it('removes JWT-shaped values and E.164 numbers, quoted or bare', () => {
    const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1In0.sig';
    const out = scrubMessage(`bad token ${jwt} for +14155550123 and "+8801712345678"`);
    expect(out).not.toContain('eyJ');
    expect(out).not.toContain('14155550123');
    expect(out).not.toContain('8801712345678');
  });

  it('removes values quoted by driver errors, wherever the message starts', () => {
    expect(scrubMessage('Transaction failed: Invalid `prisma.user.create()` invocation')).toBe(
      'Database error (details removed)',
    );
    expect(
      scrubMessage(
        'Key (phone)=(01712345678) already exists. duplicate key value violates unique constraint',
      ),
    ).toBe('Database error (details removed)');
  });

  it('removes local and grouped phone numbers but not short numbers', () => {
    expect(scrubMessage('call 01712345678 now')).toBe('call [phone] now');
    expect(scrubMessage('call 171-234-5678 now')).toBe('call [phone] now');
    expect(scrubMessage('3 items, 120 grams, 2026')).toBe('3 items, 120 grams, 2026');
  });

  it('is bounded: a hostile message cannot stall the scrubber', () => {
    const started = performance.now();
    const hostile = '1 '.repeat(200_000) + 'x';
    expect(scrubMessage(hostile).length).toBeLessThanOrEqual(8_000);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('Sentry scrubbing of values, tags, spans and headers', () => {
  it('scrubs strings inside extra, contexts and tags, and personal keys at any depth', () => {
    const scrubbed = scrubEvent({
      extra: { note: 'user rahim@auren.test failed', customerEmail: 'rahim@auren.test' },
      tags: { actor: 'rahim@auren.test' },
      contexts: { order: { shippingAddress: '12 Road 5', id: 'o-1' } },
    } as unknown as ErrorEvent);
    const text = JSON.stringify(scrubbed);
    expect(text).not.toContain('rahim@auren.test');
    expect(text).not.toContain('Road 5');
    expect(text).toContain('o-1');
  });

  it('removes referers, forwarded addresses and webhook signatures from request headers', () => {
    const scrubbed = scrubEvent({
      request: {
        url: 'https://auren.example/reset?token=abc',
        headers: {
          Referer: 'https://auren.example/reset/abc',
          'CF-Connecting-IP': '203.0.113.5',
          'X-Vercel-IP-City': 'Dhaka',
          'Stripe-Signature': 't=1,v1=abc',
          Accept: '*/*',
        },
      },
    } as unknown as ErrorEvent);
    expect(scrubbed.request?.headers).toEqual({ Accept: '*/*' });
    expect(scrubbed.request?.url).toBe('https://auren.example/reset');
  });
});
