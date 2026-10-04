import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  rateLimit: vi.fn(),
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
vi.mock('@/modules/inventory/service', () => ({ getAvailability: mocks.getAvailability }));

import { addToCart } from '../actions';

const VARIANT = '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e6f';
const stock = (available: number) =>
  new Map([[VARIANT, { variantId: VARIANT, onHand: available, reserved: 0, available }]]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.getAvailability.mockResolvedValue(stock(5));
});

describe('addToCart', () => {
  it('re-checks live stock and honestly reports that nothing was saved yet', async () => {
    const result = await addToCart({ variantId: VARIANT, quantity: 1 });
    expect(result).toEqual({
      ok: true,
      data: { variantId: VARIANT, quantity: 1, persisted: false },
    });
    expect(mocks.getAvailability).toHaveBeenCalledWith([VARIANT]);
  });

  it('refuses invalid input without touching stock', async () => {
    for (const input of [
      null,
      {},
      { variantId: 'nope', quantity: 1 },
      { variantId: VARIANT, quantity: 0 },
      { variantId: VARIANT, quantity: 11 },
      { variantId: VARIANT, quantity: 1.5 },
      { variantId: VARIANT, quantity: 1, price: 1 },
    ]) {
      const result = await addToCart(input);
      expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(mocks.getAvailability).not.toHaveBeenCalled();
  });

  it('refuses a size that is sold out or has no stock row', async () => {
    mocks.getAvailability.mockResolvedValue(stock(0));
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'OUT_OF_STOCK' },
    });
    mocks.getAvailability.mockResolvedValue(new Map());
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'OUT_OF_STOCK' },
    });
  });

  it('refuses more than is available, naming what is left', async () => {
    mocks.getAvailability.mockResolvedValue(stock(2));
    const result = await addToCart({ variantId: VARIANT, quantity: 3 });
    expect(result).toMatchObject({ ok: false, error: { code: 'OUT_OF_STOCK' } });
    expect(result.ok === false && result.error.message).toContain('Only 2 left');
  });

  it('is rate limited per address', async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith('addToBag', '198.51.100.9');
    expect(mocks.getAvailability).not.toHaveBeenCalled();
  });

  it('turns an unexpected failure into a safe error', async () => {
    mocks.getAvailability.mockRejectedValue(new DomainError('INTERNAL'));
    expect(await addToCart({ variantId: VARIANT, quantity: 1 })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    });
  });
});
