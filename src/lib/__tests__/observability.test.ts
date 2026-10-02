import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { probe, summarize, type CheckResult } from '../health';
import { scrubBreadcrumb, scrubEvent, scrubTransaction, stripQuery } from '../observability/scrub';

const ok: CheckResult = { status: 'ok', latencyMs: 3 };
const down: CheckResult = { status: 'down', latencyMs: 2000, error: 'unreachable' };
const skipped: CheckResult = { status: 'skipped', reason: 'not configured' };
const meta = { version: 'abc1234', uptimeSeconds: 12 };

describe('health summary', () => {
  it('is ok when the database answers and Redis is fine or not configured', () => {
    expect(summarize(ok, ok, meta).status).toBe('ok');
    expect(summarize(ok, skipped, meta).status).toBe('ok');
  });

  it('is down when the database is unreachable, whatever Redis says', () => {
    expect(summarize(down, ok, meta).status).toBe('down');
    expect(summarize(down, skipped, meta).status).toBe('down');
  });

  it('is degraded, not down, when only Redis is lost (rate limiting falls back to memory)', () => {
    expect(summarize(ok, down, meta).status).toBe('degraded');
  });
});

describe('probe', () => {
  it('reports success with latency', async () => {
    const result = await probe(async () => 1);
    expect(result.status).toBe('ok');
  });

  it('turns a thrown error into a generic down result without leaking the message', async () => {
    const result = await probe(async () => {
      throw new Error('connect ECONNREFUSED postgres://user:secret@10.0.0.5/db');
    });
    expect(result).toMatchObject({ status: 'down', error: 'unreachable' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('gives up after the deadline', async () => {
    const result = await probe(() => new Promise(() => undefined));
    expect(result).toMatchObject({ status: 'down', error: 'timeout' });
  }, 5_000);
});

describe('Sentry event scrubbing', () => {
  const event = (over: Partial<ErrorEvent>): ErrorEvent => ({ type: undefined, ...over });

  it('removes credentials, cookies, bodies and query strings from the request', () => {
    const scrubbed = scrubEvent(
      event({
        request: {
          url: 'https://auren.com.bd/checkout?email=a@b.com&token=abc',
          query_string: 'email=a@b.com',
          cookies: { 'auren.session_token': 'secret' },
          data: { password: 'hunter2' },
          headers: { Authorization: 'Bearer x', Cookie: 'a=b', 'User-Agent': 'jest' },
        },
      }),
    );
    expect(scrubbed.request?.url).toBe('https://auren.com.bd/checkout');
    expect(scrubbed.request?.headers).toEqual({ 'User-Agent': 'jest' });
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
  });

  it('keeps only the user id', () => {
    const scrubbed = scrubEvent(
      event({ user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4', username: 'rahim' } }),
    );
    expect(scrubbed.user).toEqual({ id: 'u1' });
    expect(scrubEvent(event({ user: { email: 'a@b.com' } })).user).toEqual({});
  });

  it('redacts sensitive keys in extra data and contexts at any depth', () => {
    const scrubbed = scrubEvent(
      event({
        extra: { orderId: 'o1', customer: { phone: '017', note: 'ok' }, list: [{ apiKey: 'k' }] },
        contexts: { app: { app_name: 'auren' }, auth: { sessionToken: 't' } as never },
      }),
    );
    const text = JSON.stringify(scrubbed);
    for (const leaked of ['017', '"k"', '"t"']) expect(text).not.toContain(leaked);
    expect(scrubbed.extra).toMatchObject({ orderId: 'o1', customer: { note: 'ok' } });
  });

  it('drops client addresses from request headers', () => {
    const scrubbed = scrubEvent(
      event({
        request: {
          headers: { 'X-Forwarded-For': '1.2.3.4', 'x-real-ip': '1.2.3.4', Accept: '*/*' },
        },
      }),
    );
    expect(scrubbed.request?.headers).toEqual({ Accept: '*/*' });
  });
});

describe('Sentry transactions and breadcrumbs', () => {
  it('strips one-time tokens from URLs', () => {
    expect(stripQuery('https://auren.com.bd/reset-password/abc?token=secret#x')).toBe(
      'https://auren.com.bd/reset-password/abc',
    );
    const transaction = scrubTransaction({
      type: 'transaction',
      transaction: '/api/auth/verify-email?token=abc',
      request: { url: 'https://auren.com.bd/api/auth/verify-email?token=abc' },
    });
    expect(JSON.stringify(transaction)).not.toContain('token=abc');
  });

  it('cleans navigation breadcrumbs and drops free text console messages', () => {
    const nav = scrubBreadcrumb({
      category: 'navigation',
      data: { from: '/login?next=%2Fadmin', to: '/reset?token=abc', other: 1 },
    });
    expect(nav.data).toEqual({ from: '/login', to: '/reset', other: 1 });
    expect(
      scrubBreadcrumb({ category: 'console', message: 'user a@b.com failed' }).message,
    ).toBeUndefined();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button.primary' }).message).toBe(
      'button.primary',
    );
  });
});
