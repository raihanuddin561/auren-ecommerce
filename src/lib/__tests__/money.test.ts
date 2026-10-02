import { describe, expect, it } from 'vitest';
import * as m from '../money';
import { MoneyError } from '../money';

const bdt = (minor: bigint | number | string) => m.money(minor, 'BDT');
const minors = (items: m.Money[]) => items.map((i) => i.minor);

function expectCode(fn: () => unknown, code: m.MoneyErrorCode) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(MoneyError);
    expect((error as MoneyError).code).toBe(code);
    return;
  }
  throw new Error(`expected MoneyError ${code}`);
}

describe('construction', () => {
  it('accepts bigint, safe integers and integer strings', () => {
    expect(bdt(100n).minor).toBe(100n);
    expect(bdt(100).minor).toBe(100n);
    expect(bdt('-250').minor).toBe(-250n);
    expect(m.zero('BDT')).toEqual({ minor: 0n, currency: 'BDT' });
  });

  it('is immutable', () => {
    expect(Object.isFrozen(bdt(1))).toBe(true);
  });

  it('rejects floats, unsafe integers and non-integer text', () => {
    expectCode(() => bdt(12.5), 'INVALID_AMOUNT');
    expectCode(() => bdt(Number.MAX_SAFE_INTEGER + 1), 'INVALID_AMOUNT');
    expectCode(() => bdt('12.5'), 'INVALID_AMOUNT');
    expectCode(() => bdt('abc'), 'INVALID_AMOUNT');
  });

  it('rejects malformed and unknown currency codes', () => {
    expectCode(() => m.money(1n, 'bdt'), 'INVALID_CURRENCY');
    expectCode(() => m.money(1n, 'BDTX'), 'INVALID_CURRENCY');
    expectCode(() => m.money(1n, 'BDD'), 'INVALID_CURRENCY');
    expectCode(() => m.money(1n, 'ZZZ'), 'INVALID_CURRENCY');
  });

  it('keeps amounts inside the 64-bit column range', () => {
    expect(bdt(9_223_372_036_854_775_807n).minor).toBe(9_223_372_036_854_775_807n);
    expect(bdt(-9_223_372_036_854_775_808n).minor).toBe(-9_223_372_036_854_775_808n);
    expectCode(() => bdt(9_223_372_036_854_775_808n), 'OVERFLOW');
    expectCode(() => bdt(-9_223_372_036_854_775_809n), 'OVERFLOW');
  });

  it('knows how many decimals each currency uses', () => {
    expect(m.exponent('BDT')).toBe(2);
    expect(m.exponent('USD')).toBe(2);
    expect(m.exponent('JPY')).toBe(0);
    expect(m.exponent('KWD')).toBe(3);
    expect(m.exponent('BDT')).toBe(2);
  });

  it('recognises Money values', () => {
    expect(m.isMoney(bdt(1))).toBe(true);
    expect(m.isMoney({ minor: 1, currency: 'BDT' })).toBe(false);
    expect(m.isMoney(null)).toBe(false);
    expect(m.isMoney('1')).toBe(false);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts, negates and takes absolute values', () => {
    expect(m.add(bdt(100), bdt(250)).minor).toBe(350n);
    expect(m.subtract(bdt(100), bdt(250)).minor).toBe(-150n);
    expect(m.negate(bdt(5)).minor).toBe(-5n);
    expect(m.abs(bdt(-5)).minor).toBe(5n);
    expect(m.abs(bdt(5)).minor).toBe(5n);
  });

  it('refuses to mix currencies', () => {
    expectCode(() => m.add(bdt(1), m.money(1n, 'USD')), 'CURRENCY_MISMATCH');
    expectCode(() => m.subtract(bdt(1), m.money(1n, 'USD')), 'CURRENCY_MISMATCH');
    expectCode(() => m.compare(bdt(1), m.money(1n, 'USD')), 'CURRENCY_MISMATCH');
  });

  it('sums lists and returns a typed zero for an empty list', () => {
    expect(m.sum([bdt(100), bdt(200), bdt(300)], 'BDT').minor).toBe(600n);
    expect(m.sum([], 'BDT')).toEqual({ minor: 0n, currency: 'BDT' });
  });

  it('compares and orders', () => {
    expect(m.compare(bdt(1), bdt(2))).toBe(-1);
    expect(m.compare(bdt(2), bdt(1))).toBe(1);
    expect(m.compare(bdt(2), bdt(2))).toBe(0);
    expect(m.equals(bdt(2), bdt(2))).toBe(true);
    expect(m.equals(bdt(2), m.money(2n, 'USD'))).toBe(false);
    expect(m.min(bdt(1), bdt(2)).minor).toBe(1n);
    expect(m.min(bdt(2), bdt(1)).minor).toBe(1n);
    expect(m.max(bdt(1), bdt(2)).minor).toBe(2n);
    expect(m.max(bdt(2), bdt(1)).minor).toBe(2n);
    expect(m.isZero(bdt(0))).toBe(true);
    expect(m.isPositive(bdt(1))).toBe(true);
    expect(m.isNegative(bdt(-1))).toBe(true);
    expect(m.isZero(bdt(1))).toBe(false);
  });

  it('multiplies by whole quantities only', () => {
    expect(m.multiply(bdt(129900), 3).minor).toBe(389700n);
    expect(m.multiply(bdt(129900), 3n).minor).toBe(389700n);
    expectCode(() => m.multiply(bdt(1), 1.5), 'INVALID_AMOUNT');
  });

  it('is exact at amounts beyond double precision', () => {
    const big = bdt(9_007_199_254_740_993n);
    expect(m.add(big, bdt(2)).minor).toBe(9_007_199_254_740_995n);
  });
});

describe('rounding', () => {
  const modes = ['half-even', 'half-up', 'down', 'up'] as const;
  type Expected = Record<(typeof modes)[number], bigint>;
  const cases: Array<[bigint, bigint, Expected]> = [
    [5n, 2n, { 'half-even': 2n, 'half-up': 3n, down: 2n, up: 3n }],
    [7n, 2n, { 'half-even': 4n, 'half-up': 4n, down: 3n, up: 4n }],
    [-5n, 2n, { 'half-even': -2n, 'half-up': -3n, down: -2n, up: -3n }],
    [5n, -2n, { 'half-even': -2n, 'half-up': -3n, down: -2n, up: -3n }],
    [-7n, -2n, { 'half-even': 4n, 'half-up': 4n, down: 3n, up: 4n }],
    [10n, 4n, { 'half-even': 2n, 'half-up': 3n, down: 2n, up: 3n }],
    [13n, 4n, { 'half-even': 3n, 'half-up': 3n, down: 3n, up: 4n }],
    [15n, 4n, { 'half-even': 4n, 'half-up': 4n, down: 3n, up: 4n }],
    [6n, 3n, { 'half-even': 2n, 'half-up': 2n, down: 2n, up: 2n }],
    [0n, 3n, { 'half-even': 0n, 'half-up': 0n, down: 0n, up: 0n }],
  ];

  it.each(cases)('divides %s / %s with every mode', (n, d, expected) => {
    for (const mode of modes) {
      expect(m.divideRound(n, d, mode)).toBe(expected[mode]);
    }
  });

  it('rejects division by zero', () => {
    expectCode(() => m.divideRound(1n, 0n, 'half-even'), 'DIVISION_BY_ZERO');
  });

  it('rounds ties to even for percentages (banker rounding)', () => {
    expect(m.percent(bdt(250), 100).minor).toBe(2n); // 2.5 -> 2
    expect(m.percent(bdt(350), 100).minor).toBe(4n); // 3.5 -> 4
    expect(m.percent(bdt(250), 100, 'half-up').minor).toBe(3n);
  });

  it('computes percentages in basis points', () => {
    expect(m.percent(bdt(100000), 1500).minor).toBe(15000n);
    expect(m.percent(bdt(100000), 1500n).minor).toBe(15000n);
    expect(m.percent(bdt(-100000), 1500).minor).toBe(-15000n);
  });

  it('scales by a ratio', () => {
    expect(m.ratio(bdt(1000), 1, 3).minor).toBe(333n);
    expect(m.ratio(bdt(1000), 2n, 3n, 'up').minor).toBe(667n);
    expectCode(() => m.ratio(bdt(1), 1, 0), 'DIVISION_BY_ZERO');
  });
});

describe('tax', () => {
  it('extracts the tax contained in a tax-inclusive price', () => {
    expect(m.inclusiveTax(bdt(115000), 1500).minor).toBe(15000n);
    expect(m.inclusiveTax(bdt(999), 1500).minor).toBe(130n);
    expect(m.inclusiveTax(bdt(999), 1500n, 'up').minor).toBe(131n);
  });

  it('keeps net plus tax equal to the gross for inclusive prices', () => {
    for (const gross of [1n, 99n, 999n, 12345n, 129900n, 987654321n]) {
      const tax = m.inclusiveTax(bdt(gross), 750);
      const net = m.subtract(bdt(gross), tax);
      expect(net.minor + tax.minor).toBe(gross);
      expect(tax.minor).toBeGreaterThanOrEqual(0n);
    }
  });

  it('rejects nonsensical rates', () => {
    expectCode(() => m.inclusiveTax(bdt(100), -1), 'INVALID_AMOUNT');
    expectCode(() => m.inclusiveTax(bdt(100), 10001), 'INVALID_AMOUNT');
    expectCode(() => m.percent(bdt(100), -5), 'INVALID_AMOUNT');
  });

  it('adds tax on a tax-exclusive price', () => {
    expect(m.exclusiveTax(bdt(100000), 1500).minor).toBe(15000n);
  });
});

describe('allocation', () => {
  it('splits proportionally and always sums to the total', () => {
    const parts = m.allocate(bdt(1000), [1, 1, 1]);
    expect(minors(parts)).toEqual([334n, 333n, 333n]);
    expect(m.sum(parts, 'BDT').minor).toBe(1000n);
  });

  it('spreads a discount across order lines by line value', () => {
    const parts = m.allocate(bdt(2500), [129900n, 49900n, 19900n]);
    expect(m.sum(parts, 'BDT').minor).toBe(2500n);
    expect(minors(parts)).toEqual([1626n, 625n, 249n]);
  });

  it('gives remainders to the largest fraction first, ties to the earlier index', () => {
    expect(minors(m.allocate(bdt(5), [1, 2, 2]))).toEqual([1n, 2n, 2n]);
    expect(minors(m.allocate(bdt(2), [1, 1, 1]))).toEqual([1n, 1n, 0n]);
    expect(minors(m.allocate(bdt(1), [1, 3, 3]))).toEqual([0n, 1n, 0n]);
  });

  it('handles zero weights, zero totals and negative totals', () => {
    expect(minors(m.allocate(bdt(100), [0, 1, 0]))).toEqual([0n, 100n, 0n]);
    expect(minors(m.allocate(bdt(0), [1, 2]))).toEqual([0n, 0n]);
    const negative = m.allocate(bdt(-1000), [1, 1, 1]);
    expect(minors(negative)).toEqual([-334n, -333n, -333n]);
    expect(m.sum(negative, 'BDT').minor).toBe(-1000n);
  });

  it('sums exactly across many totals', () => {
    for (let total = 0n; total < 400n; total += 7n) {
      expect(m.sum(m.allocate(bdt(total), [3n, 5n, 11n, 1n, 17n]), 'BDT').minor).toBe(total);
    }
  });

  it('rejects impossible allocations', () => {
    expectCode(() => m.allocate(bdt(1), []), 'INVALID_ALLOCATION');
    expectCode(() => m.allocate(bdt(1), [0, 0]), 'INVALID_ALLOCATION');
    expectCode(() => m.allocate(bdt(1), [1, -1]), 'INVALID_ALLOCATION');
  });

  it('splits evenly', () => {
    expect(minors(m.split(bdt(100), 3))).toEqual([34n, 33n, 33n]);
    expectCode(() => m.split(bdt(100), 0), 'INVALID_ALLOCATION');
    expectCode(() => m.split(bdt(100), 1.5), 'INVALID_ALLOCATION');
  });
});

describe('decimal text', () => {
  it('prints minor units as decimal text', () => {
    expect(m.toDecimalString(bdt(129900))).toBe('1299.00');
    expect(m.toDecimalString(bdt(5))).toBe('0.05');
    expect(m.toDecimalString(bdt(0))).toBe('0.00');
    expect(m.toDecimalString(bdt(-1050))).toBe('-10.50');
    expect(m.toDecimalString(m.money(1500n, 'JPY'))).toBe('1500');
    expect(m.toDecimalString(m.money(1234n, 'KWD'))).toBe('1.234');
  });

  it('parses what a person types without floats', () => {
    expect(m.fromDecimalString('1,299.50', 'BDT').minor).toBe(129950n);
    expect(m.fromDecimalString('1299', 'BDT').minor).toBe(129900n);
    expect(m.fromDecimalString(' 0.1 ', 'BDT').minor).toBe(10n);
    expect(m.fromDecimalString('-5.05', 'BDT').minor).toBe(-505n);
    expect(m.fromDecimalString('1500', 'JPY').minor).toBe(1500n);
  });

  it('never rounds silently when parsing', () => {
    expectCode(() => m.fromDecimalString('1.999', 'BDT'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('12.5', 'JPY'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('abc', 'BDT'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('', 'BDT'), 'INVALID_AMOUNT');
  });

  it('only accepts commas as thousands separators', () => {
    expectCode(() => m.fromDecimalString('1,5', 'BDT'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('1,29', 'BDT'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('1,,200', 'BDT'), 'INVALID_AMOUNT');
    expectCode(() => m.fromDecimalString('1,2345', 'BDT'), 'INVALID_AMOUNT');
    expect(m.fromDecimalString('12,345,678.90', 'BDT').minor).toBe(1234567890n);
  });

  it('round-trips through text', () => {
    for (const minor of [0n, 1n, 99n, 100n, 12345n, -98765n]) {
      expect(m.fromDecimalString(m.toDecimalString(bdt(minor)), 'BDT').minor).toBe(minor);
    }
  });
});

describe('formatting', () => {
  it('formats with the currency symbol and grouping', () => {
    const text = m.format(bdt(129900));
    expect(text).toContain('1,299.00');
    expect(text).toMatch(/৳|BDT/);
  });

  it('can drop a zero fraction', () => {
    expect(m.format(bdt(129900), { trimZeroFraction: true })).not.toContain('.00');
    expect(m.format(bdt(129950), { trimZeroFraction: true })).toContain('1,299.50');
  });

  it('formats negative amounts and other locales', () => {
    expect(m.format(bdt(-5000))).toContain('50.00');
    expect(m.format(m.money(123456n, 'USD'), { locale: 'en-US' })).toBe('$1,234.56');
  });

  it('formats amounts beyond double precision exactly', () => {
    expect(m.format(m.money(9_007_199_254_740_993n, 'USD'), { locale: 'en-US' })).toBe(
      '$90,071,992,547,409.93',
    );
  });
});

describe('persistence helpers', () => {
  it('serializes to and from JSON-safe values', () => {
    const value = bdt(9_007_199_254_740_993n);
    const json = JSON.stringify(m.serialize(value));
    expect(json).toBe('{"minor":"9007199254740993","currency":"BDT"}');
    expect(m.deserialize(JSON.parse(json))).toEqual(value);
  });
});
