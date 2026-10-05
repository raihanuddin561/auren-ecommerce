import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';
import { emptyCartView } from '../view';

const mocks = vi.hoisted(() => ({
  addLine: vi.fn(),
  setLineQuantity: vi.fn(),
  getView: vi.fn(),
  rateLimit: vi.fn(),
  readCartIdentity: vi.fn(),
  writeCartCookie: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
}));
vi.mock('@/lib/request-meta', () => ({
  getRequestMeta: async () => ({ ip: '198.51.100.9', userAgent: 'vitest' }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('../service', () => ({
  addLine: mocks.addLine,
  setLineQuantity: mocks.setLineQuantity,
  getView: mocks.getView,
}));
vi.mock('../cookie', () => ({
  readCartIdentity: mocks.readCartIdentity,
  writeCartCookie: mocks.writeCartCookie,
}));

import { addToCart, refreshCart, setCartLine } from '../actions';

const VARIANT = '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e6f';
const view = emptyCartView('BDT', null);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.readCartIdentity.mockResolvedValue({ userId: null, token: null });
  mocks.addLine.mockResolvedValue({ view, newToken: null });
  mocks.setLineQuantity.mockResolvedValue({ view, newToken: null });
});

describe('addToCart', () => {
  it('adds the line for the caller identity and returns the server-computed bag', async () => {
    const result = await addToCart({ variantId: VARIANT, quantity: 2 });
    expect(result).toEqual({ ok: true, data: { view } });
    expect(mocks.addLine).toHaveBeenCalledWith(
      { userId: null, token: null },
      { variantId: VARIANT, quantity: 2 },
    );
    expect(mocks.writeCartCookie).not.toHaveBeenCalled();
  });

  it('sets the bag cookie only when a new bag was created', async () => {
    mocks.addLine.mockResolvedValue({ view, newToken: 'a'.repeat(43) });
    await addToCart({ variantId: VARIANT, quantity: 1 });
    expect(mocks.writeCartCookie).toHaveBeenCalledWith('a'.repeat(43));
  });

  it('refuses invalid input, including client-sent prices, before doing any work (INV-O8)', async () => {
    for (const input of [
      null,
      {},
      { variantId: 'nope', quantity: 1 },
      { variantId: VARIANT, quantity: 0 },
      { variantId: VARIANT, quantity: 11 },
      { variantId: VARIANT, quantity: 1.5 },
      { variantId: VARIANT, quantity: 1, price: 1 },
      { variantId: VARIANT, quantity: 1, total: '0' },
    ]) {
      expect(await addToCart(input)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(mocks.addLine).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it('is rate limited per address', async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith('addToBag', '198.51.100.9');
    expect(mocks.addLine).not.toHaveBeenCalled();
  });

  it('passes a stock refusal on with its message', async () => {
    mocks.addLine.mockRejectedValue(new DomainError('OUT_OF_STOCK', 'Only 2 left in that size.'));
    expect(await addToCart({ variantId: VARIANT, quantity: 3 })).toMatchObject({
      ok: false,
      error: { code: 'OUT_OF_STOCK', message: 'Only 2 left in that size.' },
    });
  });

  it('turns an unexpected failure into a safe error', async () => {
    mocks.addLine.mockRejectedValue(new Error('boom'));
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    });
  });
});

describe('setCartLine', () => {
  it('sets, removes (zero) and restores with one contract', async () => {
    expect(await setCartLine({ variantId: VARIANT, quantity: 0 })).toMatchObject({ ok: true });
    expect(mocks.setLineQuantity).toHaveBeenLastCalledWith(expect.anything(), {
      variantId: VARIANT,
      quantity: 0,
    });
    expect(await setCartLine({ variantId: VARIANT, quantity: 3 })).toMatchObject({ ok: true });
  });

  it('rejects unknown fields and out-of-range quantities', async () => {
    for (const input of [
      { variantId: VARIANT, quantity: -1 },
      { variantId: VARIANT, quantity: 11 },
      { variantId: VARIANT, quantity: 1, unitPrice: 5 },
    ]) {
      expect(await setCartLine(input)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(mocks.setLineQuantity).not.toHaveBeenCalled();
  });
});

describe('refreshCart', () => {
  it('returns the current bag', async () => {
    mocks.getView.mockResolvedValue(view);
    expect(await refreshCart()).toEqual({ ok: true, data: { view } });
  });
});
