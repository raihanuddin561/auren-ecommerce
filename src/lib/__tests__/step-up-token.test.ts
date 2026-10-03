import { describe, expect, it } from 'vitest';
import { signStepUp, verifyStepUp } from '../step-up-token';

const secret = 'k7Q2v9XrT4bYh8LmC3sPd6JfGa1UeVn5';
const claims = {
  sessionId: 'sess-1',
  userId: 'user-1',
  purpose: 'orders.refund',
  issuedAt: 1_000_000,
};
const check = (token: string | undefined, over: Partial<Parameters<typeof verifyStepUp>[2]> = {}) =>
  verifyStepUp(secret, token, {
    sessionId: 'sess-1',
    userId: 'user-1',
    purpose: 'orders.refund',
    nowSeconds: 1_000_060,
    windowSeconds: 600,
    ...over,
  });

describe('step-up token', () => {
  const token = signStepUp(secret, claims);

  it('accepts a fresh token for the same session and user', () => {
    expect(check(token)).toBe(true);
  });

  it('rejects an expired token and one from the future', () => {
    expect(check(token, { nowSeconds: 1_000_601 })).toBe(false);
    expect(check(token, { nowSeconds: 999_000 })).toBe(false);
  });

  it('is bound to the session and the user', () => {
    expect(check(token, { sessionId: 'sess-2' })).toBe(false);
    expect(check(token, { userId: 'user-2' })).toBe(false);
  });

  it('is bound to the purpose it was granted for', () => {
    expect(check(token, { purpose: 'customers.export' })).toBe(false);
    expect(check(token.replace('orders.refund', 'customers.export'))).toBe(false);
  });

  it('rejects tampering, another key, truncation and garbage', () => {
    expect(check(token.replace('1000000', '1000050'))).toBe(false);
    expect(check(`${token}x`)).toBe(false);
    expect(check(token.slice(0, -4))).toBe(false);
    expect(
      verifyStepUp('another-secret-another-secret-0123', token, {
        sessionId: 'sess-1',
        userId: 'user-1',
        purpose: 'orders.refund',
        nowSeconds: 1_000_060,
        windowSeconds: 600,
      }),
    ).toBe(false);
    expect(check(undefined)).toBe(false);
    expect(check('')).toBe(false);
    expect(check('a:b:c:d')).toBe(false);
    expect(check('x'.repeat(500))).toBe(false);
  });

  it('rejects a non-numeric issue time even with a valid-looking signature shape', () => {
    expect(check('sess-1:user-1:orders.refund:abc:AAAA')).toBe(false);
    const fractional = signStepUp(secret, { ...claims, issuedAt: 1_000_000.5 });
    expect(check(fractional)).toBe(false);
  });
});
