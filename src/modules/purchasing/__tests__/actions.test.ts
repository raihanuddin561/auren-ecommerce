import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';
import { toPermissionSet, type Permission, type StaffContext } from '@/lib/permissions';

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  updateTag: vi.fn(),
  createSupplier: vi.fn(),
  createPurchaseOrder: vi.fn(),
  receiveGoods: vi.fn(),
  addLandedCost: vi.fn(),
  placeOrder: vi.fn(),
}));

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
}));
vi.mock('@/lib/staff', () => ({ requireStaff: mocks.requireStaff }));
vi.mock('@/lib/request-meta', () => ({
  getRequestMeta: async () => ({ ip: '198.51.100.9', userAgent: 'vitest' }),
}));
vi.mock('../service', () => ({
  createSupplier: mocks.createSupplier,
  createPurchaseOrder: mocks.createPurchaseOrder,
  receiveGoods: mocks.receiveGoods,
  addLandedCost: mocks.addLandedCost,
  placeOrder: mocks.placeOrder,
}));

import {
  addLandedCost,
  createPurchaseOrder,
  createSupplier,
  placePurchaseOrder,
  receiveGoods,
} from '../actions';

const staff = (role: StaffContext['role'], permissions: Permission[]): StaffContext => ({
  id: 'staff-1',
  userId: 'user-1',
  role,
  name: 'Test',
  email: 't@auren.test',
  permissions: toPermissionSet(permissions),
});

const uuid = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
const line = { variantId: uuid, quantityOrdered: 5, unitCost: '1250.50' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupplier.mockResolvedValue({ data: { id: uuid }, tags: [] });
  mocks.createPurchaseOrder.mockResolvedValue({
    data: { id: uuid, poNumber: 'PO-0001' },
    tags: [],
  });
  mocks.receiveGoods.mockResolvedValue({
    data: { receiptId: uuid, status: 'received', replayed: false },
    tags: [`stock:${uuid}`, 'stock'],
  });
});

describe('purchasing actions: guard order (INV-A1)', () => {
  it('rejects unknown keys before anyone is authenticated', async () => {
    const result = await createSupplier({ name: 'Acme', isAdmin: true });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.requireStaff).not.toHaveBeenCalled();
  });

  it('refuses a signed-out caller and a customer', async () => {
    mocks.requireStaff.mockRejectedValue(new DomainError('UNAUTHENTICATED'));
    expect(await createSupplier({ name: 'Acme' })).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
    mocks.requireStaff.mockRejectedValue(new DomainError('FORBIDDEN'));
    expect(await createSupplier({ name: 'Acme' })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('refuses staff without purchasing.manage, for every purchasing action', async () => {
    mocks.requireStaff.mockResolvedValue(staff('fulfillment', ['inventory.read']));
    const results = await Promise.all([
      createSupplier({ name: 'Acme' }),
      createPurchaseOrder({ supplierId: uuid, lines: [line] }),
      placePurchaseOrder({ id: uuid }),
      addLandedCost({ poId: uuid, type: 'freight', amount: '10', method: 'by_value' }),
      receiveGoods({
        poId: uuid,
        idempotencyKey: 'abcdefgh-1',
        lines: [{ poItemId: uuid, quantity: 1 }],
      }),
    ]);
    for (const result of results) {
      expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    }
    expect(mocks.createSupplier).not.toHaveBeenCalled();
    expect(mocks.receiveGoods).not.toHaveBeenCalled();
  });

  it('validates money text, duplicate variants and quantities', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['purchasing.manage']));
    expect(
      await createPurchaseOrder({ supplierId: uuid, lines: [{ ...line, unitCost: '12.505' }] }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(await createPurchaseOrder({ supplierId: uuid, lines: [line, line] })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(
      await createPurchaseOrder({ supplierId: uuid, lines: [{ ...line, quantityOrdered: 0 }] }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('receives goods and invalidates the stock tags', async () => {
    mocks.requireStaff.mockResolvedValue(staff('manager', ['purchasing.manage']));
    const result = await receiveGoods({
      poId: uuid,
      idempotencyKey: 'abcdefgh-1',
      lines: [{ poItemId: uuid, quantity: 3 }],
    });
    expect(result).toMatchObject({ ok: true, data: { status: 'received' } });
    expect(mocks.updateTag).toHaveBeenCalledWith(`stock:${uuid}`);
  });
});
