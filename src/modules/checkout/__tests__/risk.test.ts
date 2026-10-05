import { describe, expect, it } from 'vitest';
import { isDomainError } from '@/lib/errors';
import { money } from '@/lib/money';
import { DEFAULT_CHECKOUT_PROTECTION } from '@/modules/settings/schemas';
import {
  assertWithinLimits,
  assessRisk,
  BLOCKING_FLAGS,
  isBlocked,
  type VelocityCounts,
} from '../risk';

const counts = (overrides: Partial<VelocityCounts> = {}): VelocityCounts => ({
  openByPhone: 0,
  dayByPhone: 0,
  everByPhone: 1,
  openByAddress: 0,
  dayByIp: 0,
  heldUnits: new Map(),
  ...overrides,
});

const line = { variantId: 'v1', quantity: 1, label: 'Oxford shirt (M)' };
const refusal = (c: VelocityCounts, lines = [line]) => {
  try {
    assertWithinLimits(c, DEFAULT_CHECKOUT_PROTECTION, lines);
  } catch (error) {
    return isDomainError(error) ? { code: error.code, message: error.message } : null;
  }
  return 'allowed';
};

describe('order velocity limits (INV-O11)', () => {
  it('allows an ordinary customer', () => {
    expect(refusal(counts())).toBe('allowed');
  });

  it('stops at the open-order limit per phone, and at the daily and address limits', () => {
    const limits = DEFAULT_CHECKOUT_PROTECTION;
    expect(refusal(counts({ openByPhone: limits.maxOpenOrdersPerPhone - 1 }))).toBe('allowed');
    expect(refusal(counts({ openByPhone: limits.maxOpenOrdersPerPhone }))).toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(refusal(counts({ dayByPhone: limits.maxOrdersPerPhonePerDay }))).toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(refusal(counts({ openByAddress: limits.maxOpenOrdersPerAddress }))).toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(refusal(counts({ dayByIp: limits.maxOrdersPerIpPerDay }))).toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('caps the units of one variant a phone may hold, counting what it already holds', () => {
    const cap = DEFAULT_CHECKOUT_PROTECTION.maxUnitsPerVariantPerPhone;
    const held = new Map([['v1', cap - 1]]);
    expect(refusal(counts({ heldUnits: held }))).toBe('allowed');
    expect(refusal(counts({ heldUnits: held }), [{ ...line, quantity: 2 }])).toMatchObject({
      code: 'RATE_LIMITED',
      message: expect.stringContaining(`limited to ${cap} pieces`),
    });
    expect(refusal(counts({ heldUnits: new Map([['other', 99]]) }))).toBe('allowed');
  });

  it('the messages tell the customer what to do and never reveal internal rules or flags', () => {
    const message = (refusal(counts({ openByPhone: 9 })) as { message: string }).message;
    expect(message).toMatch(/wait for our call|concierge/i);
    expect(message).not.toMatch(/blocklist|risk|flag/i);
  });
});

describe('blocklist and risk score', () => {
  it('blocks fake order, repeat return and abuse flags only', () => {
    expect([...BLOCKING_FLAGS].sort()).toEqual(['abusive', 'fake_order', 'repeat_rto']);
    expect(isBlocked(['fake_order'])).toBe(true);
    expect(isBlocked(['manual'])).toBe(false);
    expect(isBlocked([])).toBe(false);
  });

  it('scores first orders, high value and repeats, capped at 100, without ever blocking', () => {
    const calm = assessRisk({ counts: counts(), total: money(250000n, 'BDT'), flagsOnRecord: [] });
    expect(calm).toEqual({ score: 0, flags: [] });
    const busy = assessRisk({
      counts: counts({ everByPhone: 0, dayByPhone: 2, openByPhone: 1 }),
      total: money(1_500_000n, 'BDT'),
      flagsOnRecord: ['manual'],
    });
    expect(busy.flags).toEqual([
      'first_order',
      'high_value',
      'repeat_today',
      'open_order_exists',
      'flag_on_record',
    ]);
    expect(busy.score).toBe(85);
    expect(
      assessRisk({ counts: counts(), total: money(1_499_999n, 'BDT'), flagsOnRecord: [] }).flags,
    ).not.toContain('high_value');
  });
});
