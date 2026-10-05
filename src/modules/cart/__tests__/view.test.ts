import { describe, expect, it } from 'vitest';
import { deserialize, money } from '@/lib/money';
import { hashCartToken, isCartToken, newCartToken } from '../token';
import { buildCartView, emptyCartView, type ViewLineInput } from '../view';

const variant = (overrides: Partial<NonNullable<ViewLineInput['variant']>> = {}) => ({
  productId: 'p1',
  productTitle: 'Oxford shirt',
  productSlug: 'oxford-shirt',
  optionsLabel: 'White / M',
  priceMinor: 250000n,
  compareAtMinor: null,
  currency: 'BDT',
  image: { url: '/seed/sand.svg', alt: 'Shirt' },
  sellable: true,
  ...overrides,
});

const line = (overrides: Partial<ViewLineInput> = {}): ViewLineInput => ({
  variantId: 'v1',
  quantity: 2,
  variant: variant(),
  available: 5,
  ...overrides,
});

const view = (lines: ViewLineInput[], threshold = money(500000n, 'BDT')) =>
  buildCartView({ currency: 'BDT', revision: '1:1', lines, threshold });

describe('cart view', () => {
  it('multiplies the database price by the quantity and sums the lines', () => {
    const result = view([
      line(),
      line({ variantId: 'v2', quantity: 1, variant: variant({ priceMinor: 99900n }) }),
    ]);
    expect(deserialize(result.lines[0]!.lineTotal).minor).toBe(500000n);
    expect(deserialize(result.subtotal).minor).toBe(599900n);
    expect(result.count).toBe(3);
    expect(result.hasIssues).toBe(false);
  });

  it('limits what can be held to stock and the line cap', () => {
    expect(view([line({ available: 3 })]).lines[0]!.maxQuantity).toBe(3);
    expect(view([line({ available: 99 })]).lines[0]!.maxQuantity).toBe(10);
  });

  it('flags sold out, short and unavailable lines and keeps them out of the total', () => {
    const result = view([
      line({ variantId: 'a', available: 0 }),
      line({ variantId: 'b', quantity: 4, available: 2 }),
      line({ variantId: 'c', variant: variant({ sellable: false }) }),
      line({ variantId: 'd', quantity: 1, available: 9 }),
    ]);
    expect(result.lines.map((l) => l.issue)).toEqual(['sold_out', 'short', 'unavailable', null]);
    expect(deserialize(result.subtotal).minor).toBe(250000n);
    expect(result.hasIssues).toBe(true);
  });

  it('treats a variant in another currency as unavailable', () => {
    const result = view([line({ variant: variant({ currency: 'USD' }) })]);
    expect(result.lines[0]!.issue).toBe('unavailable');
  });

  it('computes the free delivery remainder and reaching it', () => {
    const below = view([line({ quantity: 1 })]);
    expect(below.freeDelivery.reached).toBe(false);
    expect(deserialize(below.freeDelivery.remaining!).minor).toBe(250000n);
    const exact = view([line({ quantity: 2 })]);
    expect(exact.freeDelivery).toMatchObject({ reached: true, remaining: null });
    const none = view([line()], null as never);
    expect(none.freeDelivery).toMatchObject({ threshold: null, remaining: null, reached: false });
  });

  it('an empty bag is a valid view with zero totals', () => {
    const empty = emptyCartView('BDT', money(500000n, 'BDT'));
    expect(empty).toMatchObject({ count: 0, lines: [], hasIssues: false });
    expect(deserialize(empty.subtotal).minor).toBe(0n);
    expect(deserialize(empty.freeDelivery.remaining!).minor).toBe(500000n);
  });
});

describe('cart cookie token', () => {
  it('is 256 random bits in base64url and hashed with SHA-256', () => {
    const a = newCartToken();
    const b = newCartToken();
    expect(a).not.toBe(b);
    expect(isCartToken(a)).toBe(true);
    expect(hashCartToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCartToken(a)).not.toBe(hashCartToken(b));
  });

  it('rejects anything that is not a token', () => {
    for (const bad of [undefined, null, '', 'short', 'a'.repeat(44), `${'a'.repeat(42)}!`, 5]) {
      expect(isCartToken(bad)).toBe(false);
    }
  });
});
