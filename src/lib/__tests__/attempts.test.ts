import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../redis', () => ({ getRedis: () => redis.client }));

import {
  DELAY_POLICIES,
  beginAttempt,
  clearFailures,
  delayAfter,
  resetAttemptMemory,
} from '../attempts';

const policy = DELAY_POLICIES.login;

beforeEach(() => {
  redis.client = null;
  resetAttemptMemory();
});

describe('delay schedule', () => {
  it('is free for a few wrong answers, then doubles up to the cap', () => {
    const seconds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12].map((n) => delayAfter(n, policy));
    expect(seconds).toEqual([0, 0, 0, 15, 30, 60, 120, 240, 480, 900]);
    expect(delayAfter(500, policy)).toBe(policy.maxDelaySeconds);
  });
});

describe('attempt reservation (memory)', () => {
  const t0 = 1_000_000;

  it('lets the free attempts through without delay', async () => {
    for (let i = 0; i < policy.freeAttempts; i++) {
      expect(await beginAttempt('login', 'acct', t0)).toMatchObject({ blocked: false });
    }
  });

  it('blocks the next attempt, counts nothing while blocked, and unblocks after the delay', async () => {
    for (let i = 0; i < policy.freeAttempts; i++) await beginAttempt('login', 'acct', t0);
    const blocked = await beginAttempt('login', 'acct', t0 + 1000);
    expect(blocked).toMatchObject({ blocked: true, failures: policy.freeAttempts });
    expect(blocked.retryAfterSeconds).toBeGreaterThan(10);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(policy.baseDelaySeconds);
    // hammering while blocked does not make the wait longer
    for (let i = 0; i < 20; i++) await beginAttempt('login', 'acct', t0 + 2000);
    expect(await beginAttempt('login', 'acct', t0 + 16_000)).toMatchObject({ blocked: false });
  });

  it('is atomic: a burst of parallel attempts cannot all get through', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => beginAttempt('login', 'acct', t0)),
    );
    expect(results.filter((r) => !r.blocked)).toHaveLength(policy.freeAttempts);
  });

  it('delays longer with every further failure', async () => {
    for (let i = 0; i < policy.freeAttempts; i++) await beginAttempt('login', 'acct', t0);
    // after the first delay one more attempt is allowed, and then the wait doubles
    expect((await beginAttempt('login', 'acct', t0 + 16_000)).blocked).toBe(false);
    const second = await beginAttempt('login', 'acct', t0 + 17_000);
    expect(second.blocked).toBe(true);
    expect(second.retryAfterSeconds).toBe(29);
  });

  it('forgets the counter after a correct answer and after the window', async () => {
    for (let i = 0; i < 5; i++) await beginAttempt('login', 'acct', t0);
    await clearFailures('login', 'acct');
    expect(await beginAttempt('login', 'acct', t0)).toMatchObject({ blocked: false, failures: 0 });

    for (let i = 0; i < 5; i++) await beginAttempt('login', 'other', t0);
    expect(
      await beginAttempt('login', 'other', t0 + (policy.windowSeconds + 1) * 1000),
    ).toMatchObject({ blocked: false, failures: 0 });
  });

  it('keeps accounts and policies independent', async () => {
    for (let i = 0; i < 6; i++) await beginAttempt('login', 'acct-a', t0);
    expect((await beginAttempt('login', 'acct-b', t0)).blocked).toBe(false);
    expect((await beginAttempt('stepUp', 'acct-a', t0)).blocked).toBe(false);
  });
});

describe('attempt reservation (Redis)', () => {
  it('runs one atomic script and maps its answer', async () => {
    const calls: unknown[][] = [];
    redis.client = {
      eval: async (...args: unknown[]) => {
        calls.push(args);
        return [1, 42_000, 5];
      },
    };
    const status = await beginAttempt('login', 'acct', 1_000_000);
    expect(status).toEqual({ blocked: true, retryAfterSeconds: 42, failures: 5 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toEqual(['auren:af:login:acct']);
    expect(calls[0]?.[2]).toEqual([1_000_000, 3, 15, 900, 3600]);

    redis.client = { eval: async () => [0, 0, 2] };
    expect(await beginAttempt('login', 'acct')).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
      failures: 2,
    });
  });

  it('fails closed when Redis is configured but unreachable', async () => {
    redis.client = {
      eval: async () => {
        throw new Error('connection refused');
      },
    };
    const status = await beginAttempt('login', 'acct');
    expect(status).toMatchObject({ blocked: true });
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not throw when the counter cannot be cleared', async () => {
    redis.client = {
      del: async () => {
        throw new Error('down');
      },
    };
    await expect(clearFailures('login', 'acct')).resolves.toBeUndefined();
  });
});
