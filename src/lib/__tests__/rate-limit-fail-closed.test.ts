import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'down' as 'down' | 'timeout' | 'ok' }));

vi.mock('../redis', () => ({ getRedis: () => ({}) }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow() {
      return {};
    }
    async limit() {
      if (state.mode === 'down') throw new Error('redis unreachable');
      if (state.mode === 'timeout') {
        return { success: true, limit: 5, remaining: 5, reset: 0, reason: 'timeout' };
      }
      return { success: true, limit: 5, remaining: 4, reset: Date.now() + 1000 };
    }
  }
  return { Ratelimit };
});

import {
  FAIL_CLOSED,
  RATE_LIMITS,
  UNAVAILABLE_RETRY_SECONDS,
  rateLimit,
  resetMemoryLimits,
  type LimiterName,
} from '../rate-limit';

beforeEach(() => {
  state.mode = 'down';
  resetMemoryLimits();
});

const credentialLimiters: LimiterName[] = [
  'login',
  'register',
  'passwordReset',
  'verificationEmail',
  'twoFactor',
  'otp',
  'authMutation',
];

describe('limiters when Redis is configured but unavailable', () => {
  it.each(credentialLimiters)(
    '%s refuses the request instead of counting in memory',
    async (name) => {
      const result = await rateLimit(name, '203.0.113.5');
      expect(result).toMatchObject({ success: false, remaining: 0 });
      expect(result.retryAfterSeconds).toBe(UNAVAILABLE_RETRY_SECONDS);
    },
  );

  it.each(credentialLimiters)('%s also refuses when Redis answers too slowly', async (name) => {
    state.mode = 'timeout';
    expect((await rateLimit(name, '203.0.113.5')).success).toBe(false);
  });

  it('keeps reads and commerce limiters available by falling back to memory (INV-A4)', async () => {
    for (const name of ['authGeneral', 'checkoutSubmit', 'couponApply', 'reviewSubmit'] as const) {
      expect(FAIL_CLOSED.has(name)).toBe(false);
      expect((await rateLimit(name, '203.0.113.5')).success).toBe(true);
    }
  });

  it('uses Redis normally when it works', async () => {
    state.mode = 'ok';
    expect(await rateLimit('login', '203.0.113.5')).toMatchObject({ success: true, remaining: 4 });
  });

  it('covers every limiter that guards a credential or account recovery', () => {
    const guarded = Object.keys(RATE_LIMITS).filter((name) => FAIL_CLOSED.has(name as LimiterName));
    expect(guarded.sort()).toEqual([...credentialLimiters].sort());
  });
});
