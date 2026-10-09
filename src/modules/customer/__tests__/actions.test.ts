import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blockCustomer: vi.fn(),
  unblockCustomer: vi.fn(),
  requireStaff: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/staff', () => ({
  requireStaff: mocks.requireStaff,
}));

vi.mock('../service', () => ({
  blockCustomer: mocks.blockCustomer,
  unblockCustomer: mocks.unblockCustomer,
  saveAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
  updateProfile: vi.fn(),
}));

import { blockCustomerAction, unblockCustomerAction } from '../actions';

const customerUuid = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
const staffUser = {
  id: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d99',
  userId: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d98',
  role: 'admin' as const,
  name: 'Store Admin',
  email: 'admin@auren.test',
  permissions: new Set(['customers.read', 'customers.write']),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireStaff.mockResolvedValue(staffUser);
});

describe('customer admin actions', () => {
  describe('blockCustomerAction', () => {
    it('successfully blocks customer when input is valid and staff has permission', async () => {
      mocks.blockCustomer.mockResolvedValue({ id: customerUuid, banned: true });

      const result = await blockCustomerAction({
        customerId: customerUuid,
        reason: 'Fraudulent transactions observed',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.customerId).toBe(customerUuid);
      }
      expect(mocks.requireStaff).toHaveBeenCalled();
      expect(mocks.blockCustomer).toHaveBeenCalledWith(staffUser.userId, {
        customerId: customerUuid,
        reason: 'Fraudulent transactions observed',
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/customers');
    });

    it('rejects with validation error if reason is too short', async () => {
      const result = await blockCustomerAction({
        customerId: customerUuid,
        reason: 'no',
      });

      expect(result.ok).toBe(false);
      expect(mocks.blockCustomer).not.toHaveBeenCalled();
    });

    it('rejects with FORBIDDEN if staff lacks customers.write', async () => {
      mocks.requireStaff.mockResolvedValue({
        ...staffUser,
        role: 'order_verifier' as const,
        permissions: new Set(['customers.read']),
      });

      const result = await blockCustomerAction({
        customerId: customerUuid,
        reason: 'Fraudulent transactions observed',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
      expect(mocks.blockCustomer).not.toHaveBeenCalled();
    });
  });

  describe('unblockCustomerAction', () => {
    it('successfully unblocks customer when valid', async () => {
      mocks.unblockCustomer.mockResolvedValue({ id: customerUuid, banned: false });

      const result = await unblockCustomerAction({
        customerId: customerUuid,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.customerId).toBe(customerUuid);
      }
      expect(mocks.requireStaff).toHaveBeenCalled();
      expect(mocks.unblockCustomer).toHaveBeenCalledWith(staffUser.userId, customerUuid);
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/customers');
    });
  });
});
