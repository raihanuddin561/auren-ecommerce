import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';
import { toPermissionSet, type Permission, type StaffContext } from '@/lib/permissions';

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  requireStepUp: vi.fn(),
  updateTag: vi.fn(),
  adjustStock: vi.fn(),
  setCostBasis: vi.fn(),
  previewProductCost: vi.fn(),
}));

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
}));
vi.mock('@/lib/staff', () => ({ requireStaff: mocks.requireStaff }));
vi.mock('@/lib/step-up', () => ({ requireStepUp: mocks.requireStepUp }));
vi.mock('@/lib/request-meta', () => ({
  getRequestMeta: async () => ({ ip: '198.51.100.9', userAgent: 'vitest' }),
}));
vi.mock('../service', () => ({
  adjustStock: mocks.adjustStock,
  setCostBasis: mocks.setCostBasis,
  previewProductCost: mocks.previewProductCost,
}));

import { adjustStock, previewCostBasis, setCostBasis } from '../actions';

const staff = (role: StaffContext['role'], permissions: Permission[]): StaffContext => ({
  id: 'staff-1',
  userId: 'user-1',
  role,
  name: 'Test',
  email: 't@auren.test',
  permissions: toPermissionSet(permissions),
});

const variantId = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
const valid = {
  variantId,
  reason: 'count_correction',
  change: { mode: 'delta', delta: -2 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireStepUp.mockResolvedValue(undefined);
  mocks.adjustStock.mockResolvedValue({
    data: { onHand: 8, reserved: 0, delta: -2, variantId, locationId: 'l' },
    tags: [`stock:${variantId}`, 'stock'],
  });
});

describe('adjustStock action (INV-A1, INV-A6)', () => {
  it('rejects unknown keys before anyone is authenticated', async () => {
    const result = await adjustStock({ ...valid, onHand: 999 });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.requireStaff).not.toHaveBeenCalled();
  });

  it('needs a written note for write-offs and other reasons', async () => {
    const result = await adjustStock({ ...valid, reason: 'write_off' });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('refuses staff without inventory.adjust', async () => {
    mocks.requireStaff.mockResolvedValue(staff('fulfillment', ['inventory.read']));
    expect(await adjustStock(valid)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.adjustStock).not.toHaveBeenCalled();
  });

  it('refuses a signed-out caller', async () => {
    mocks.requireStaff.mockRejectedValue(new DomainError('UNAUTHENTICATED'));
    expect(await adjustStock(valid)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('adds stock without a step-up, then invalidates the stock tags', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    const result = await adjustStock({
      ...valid,
      reason: 'found',
      change: { mode: 'delta', delta: 2 },
    });
    expect(result).toMatchObject({ ok: true });
    expect(mocks.requireStepUp).not.toHaveBeenCalled();
    expect(mocks.updateTag).toHaveBeenCalledWith(`stock:${variantId}`);
    expect(mocks.updateTag).toHaveBeenCalledWith('stock');
  });

  it('any removal of stock needs a fresh step-up, whatever the reason (INV-A6)', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    mocks.requireStepUp.mockRejectedValue(new DomainError('STEP_UP_REQUIRED'));
    for (const change of [
      { mode: 'delta', delta: -1 },
      { mode: 'set', counted: 3 },
    ]) {
      const result = await adjustStock({ ...valid, change });
      expect(result).toMatchObject({ ok: false, error: { code: 'STEP_UP_REQUIRED' } });
    }
    expect(mocks.adjustStock).not.toHaveBeenCalled();
  });

  it('a write-off needs a fresh step-up first', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    mocks.requireStepUp.mockRejectedValue(new DomainError('STEP_UP_REQUIRED'));
    const result = await adjustStock({ ...valid, reason: 'damaged' });
    expect(result).toMatchObject({ ok: false, error: { code: 'STEP_UP_REQUIRED' } });
    expect(mocks.requireStepUp).toHaveBeenCalledWith(expect.anything(), 'inventory.write_off');
    expect(mocks.adjustStock).not.toHaveBeenCalled();
  });
});

const productId = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4f';
const costInput = { scope: { kind: 'variant', variantId }, unitCost: '1250.50' };

describe('adjustStock unit cost', () => {
  it('rejects a unit cost on a removal, a zero cost and a malformed cost', async () => {
    for (const bad of [
      { ...valid, unitCost: '10' },
      { ...valid, change: { mode: 'delta', delta: 2 }, unitCost: '0' },
      { ...valid, change: { mode: 'delta', delta: 2 }, unitCost: '12.345' },
      { ...valid, change: { mode: 'delta', delta: 2 }, unitCost: '-5' },
    ]) {
      expect(await adjustStock(bad)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(mocks.requireStaff).not.toHaveBeenCalled();
  });

  it('passes a valid unit cost on an addition to the service without a step-up', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    const result = await adjustStock({
      ...valid,
      reason: 'opening_stock',
      change: { mode: 'delta', delta: 5 },
      unitCost: '1250.50',
    });
    expect(result).toMatchObject({ ok: true });
    expect(mocks.requireStepUp).not.toHaveBeenCalled();
    expect(mocks.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({ unitCost: '1250.50' }),
      expect.anything(),
    );
  });
});

describe('setCostBasis action (INV-A1, INV-A6)', () => {
  beforeEach(() => {
    mocks.setCostBasis.mockResolvedValue({ updated: 2, skipped: 1, tags: ['stock', 'products'] });
  });

  it('rejects unknown keys and a client-sent cost field before authentication', async () => {
    for (const bad of [
      { ...costInput, avgCostMinor: 5 },
      { scope: { kind: 'variant', variantId, extra: 1 }, unitCost: '10' },
      { ...costInput, unitCost: '0.00' },
      { ...costInput, unitCost: 'abc' },
    ]) {
      expect(await setCostBasis(bad)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(mocks.requireStaff).not.toHaveBeenCalled();
  });

  it('refuses staff without inventory.adjust', async () => {
    mocks.requireStaff.mockResolvedValue(staff('fulfillment', ['inventory.read']));
    expect(await setCostBasis(costInput)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(mocks.requireStepUp).not.toHaveBeenCalled();
    expect(mocks.setCostBasis).not.toHaveBeenCalled();
  });

  it('needs a fresh step-up for its own purpose', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    mocks.requireStepUp.mockRejectedValue(new DomainError('STEP_UP_REQUIRED'));
    expect(await setCostBasis(costInput)).toMatchObject({
      ok: false,
      error: { code: 'STEP_UP_REQUIRED' },
    });
    expect(mocks.requireStepUp).toHaveBeenCalledWith(expect.anything(), 'inventory.set_cost');
    expect(mocks.setCostBasis).not.toHaveBeenCalled();
  });

  it('sets the cost, invalidates the tags and reports the counts', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['inventory.adjust']));
    const result = await setCostBasis({ scope: { kind: 'product', productId }, unitCost: '900' });
    expect(result).toMatchObject({ ok: true, data: { updated: 2, skipped: 1 } });
    expect(mocks.updateTag).toHaveBeenCalledWith('stock');
    expect(mocks.updateTag).toHaveBeenCalledWith('products');
  });
});

describe('previewCostBasis action', () => {
  it('needs inventory.read', async () => {
    mocks.requireStaff.mockResolvedValue(staff('fulfillment', []));
    expect(await previewCostBasis({ productId })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('returns the variants for staff who can read stock', async () => {
    mocks.requireStaff.mockResolvedValue(staff('fulfillment', ['inventory.read']));
    mocks.previewProductCost.mockResolvedValue([
      { variantId, label: 'M', sku: 'A-M', onHand: 3, hasCost: false },
    ]);
    expect(await previewCostBasis({ productId })).toMatchObject({ ok: true });
  });
});
