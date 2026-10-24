import { describe, expect, it } from 'vitest';
import { UNAMBIGUOUS_CHARSET, generateCouponCode, isValidCouponFormat } from '../generator';

describe('generateCouponCode', () => {
  it('generates a branded coupon code with default prefix AUREN', () => {
    const code = generateCouponCode();
    expect(code).toMatch(/^AUREN-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it('supports custom prefixes', () => {
    const code = generateCouponCode({ prefix: 'VIP' });
    expect(code).toMatch(/^VIP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it('supports empty prefix', () => {
    const code = generateCouponCode({ prefix: '' });
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it('never contains ambiguous characters (0, O, 1, I, L)', () => {
    const ambiguousRegex = /[0O1IL]/;
    for (let i = 0; i < 50; i++) {
      const code = generateCouponCode({ prefix: '' });
      expect(code).not.toMatch(ambiguousRegex);
      for (const char of code) {
        expect(UNAMBIGUOUS_CHARSET).toContain(char);
      }
    }
  });

  it('generates unique codes across iterations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateCouponCode());
    }
    expect(set.size).toBe(100);
  });
});

describe('isValidCouponFormat', () => {
  it('accepts valid alphanumeric coupon codes', () => {
    expect(isValidCouponFormat('AUREN-7X9K2M')).toBe(true);
    expect(isValidCouponFormat('WELCOME10')).toBe(true);
    expect(isValidCouponFormat('EID_SPECIAL_2026')).toBe(true);
  });

  it('rejects invalid or too short/long codes', () => {
    expect(isValidCouponFormat('AB')).toBe(false);
    expect(isValidCouponFormat('')).toBe(false);
    expect(isValidCouponFormat('CODE WITH SPACES')).toBe(false);
    expect(isValidCouponFormat('CODE@#$')).toBe(false);
  });
});
