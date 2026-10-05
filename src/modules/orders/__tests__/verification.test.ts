import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import * as repo from '../repository';
import * as inventory from '@/modules/inventory/service';
import * as outbox from '@/lib/outbox';
import * as auditModule from '@/modules/audit/service';
import { confirmOrder, holdOrder, cancelOrder } from '../verification';

vi.mock('../repository', () => ({
  findById: vi.fn(),
  updateOrder: vi.fn(),
  insertEvent: vi.fn(),
  findOrderItems: vi.fn(),
  createRiskFlag: vi.fn(),
}));

vi.mock('@/modules/inventory/service', () => ({
  releaseReservation: vi.fn(),
  hasSoldStock: vi.fn(),
  hasRestockedStock: vi.fn(),
  restock: vi.fn(),
}));

vi.mock('@/lib/outbox', () => ({
  enqueueEvent: vi.fn(),
}));

vi.mock('@/modules/audit/service', () => ({
  audit: vi.fn(),
}));

type FoundOrder = Awaited<ReturnType<typeof repo.findById>>;
type UpdatedOrder = Awaited<ReturnType<typeof repo.updateOrder>>;
type FoundItems = Awaited<ReturnType<typeof repo.findOrderItems>>;

describe('order verification', () => {
  const dummyTx = {} as unknown as Tx;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('confirmOrder', () => {
    it('confirms an order awaiting verification', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_1',
        orderNumber: 'AUR-001',
        status: 'placed',
      } as unknown as FoundOrder);

      vi.mocked(repo.updateOrder).mockResolvedValue({
        id: 'ord_1',
        orderNumber: 'AUR-001',
        status: 'confirmed',
      } as unknown as UpdatedOrder);

      const result = await confirmOrder(dummyTx, {
        orderId: 'ord_1',
        staffId: 'staff_1',
        note: 'Customer confirmed address',
      });

      expect(result).toEqual({
        orderId: 'ord_1',
        orderNumber: 'AUR-001',
        status: 'confirmed',
      });

      expect(repo.updateOrder).toHaveBeenCalledWith(
        dummyTx,
        'ord_1',
        expect.objectContaining({
          status: 'confirmed',
          verifier: { connect: { id: 'staff_1' } },
        }),
      );

      expect(repo.insertEvent).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          orderId: 'ord_1',
          type: 'status_changed',
          toStatus: 'confirmed',
          actorId: 'staff_1',
        }),
      );

      expect(outbox.enqueueEvent).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          type: 'order.confirmed',
          payload: { orderId: 'ord_1', confirmedBy: 'staff_1' },
        }),
      );

      expect(auditModule.audit).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          action: 'order.confirm',
          actorId: 'staff_1',
          entityId: 'ord_1',
        }),
      );
    });

    it('rejects confirmation if order does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        confirmOrder(dummyTx, { orderId: 'ord_none', staffId: 'staff_1' }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects confirmation if order is not in a confirmable status', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_1',
        orderNumber: 'AUR-001',
        status: 'cancelled',
      } as unknown as FoundOrder);

      await expect(confirmOrder(dummyTx, { orderId: 'ord_1', staffId: 'staff_1' })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('holdOrder', () => {
    it('places an order on hold and schedules next attempt', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_2',
        orderNumber: 'AUR-002',
        status: 'placed',
        verificationAttempts: 0,
      } as unknown as FoundOrder);

      vi.mocked(repo.updateOrder).mockResolvedValue({
        id: 'ord_2',
        orderNumber: 'AUR-002',
        status: 'on_hold',
      } as unknown as UpdatedOrder);

      const nextDate = new Date();
      const result = await holdOrder(dummyTx, {
        orderId: 'ord_2',
        staffId: 'staff_1',
        note: 'Customer phone busy',
        nextAttemptAt: nextDate,
      });

      expect(result).toEqual({
        orderId: 'ord_2',
        orderNumber: 'AUR-002',
        status: 'on_hold',
      });

      expect(repo.updateOrder).toHaveBeenCalledWith(
        dummyTx,
        'ord_2',
        expect.objectContaining({
          status: 'on_hold',
          verificationAttempts: { increment: 1 },
          nextAttemptAt: nextDate,
        }),
      );
    });

    it('refuses to hold an already shipped order', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_2',
        status: 'shipped',
      } as unknown as FoundOrder);

      await expect(holdOrder(dummyTx, { orderId: 'ord_2', staffId: 'staff_1' })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('cancelOrder', () => {
    it('cancels order, restocks inventory and flags fake order', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_3',
        orderNumber: 'AUR-003',
        status: 'placed',
        phone: '01711111111',
        userId: 'usr_1',
      } as unknown as FoundOrder);

      vi.mocked(inventory.hasSoldStock).mockResolvedValue(true);
      vi.mocked(inventory.hasRestockedStock).mockResolvedValue(false);
      vi.mocked(repo.findOrderItems).mockResolvedValue([
        { variantId: 'var_1', quantity: 2 },
      ] as unknown as FoundItems);

      vi.mocked(repo.updateOrder).mockResolvedValue({
        id: 'ord_3',
        orderNumber: 'AUR-003',
        status: 'cancelled',
      } as unknown as UpdatedOrder);

      const result = await cancelOrder(dummyTx, {
        orderId: 'ord_3',
        staffId: 'staff_1',
        reason: 'fake_order',
        note: 'Spam order detected',
      });

      expect(result).toEqual({
        orderId: 'ord_3',
        orderNumber: 'AUR-003',
        status: 'cancelled',
      });

      // Releases reservations
      expect(inventory.releaseReservation).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({ referenceId: 'ord_3', reason: 'fake_order' }),
      );

      // Restocks sold items
      expect(inventory.restock).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          referenceId: 'ord_3',
          lines: [{ variantId: 'var_1', quantity: 2 }],
        }),
      );

      // Flags fake order
      expect(repo.createRiskFlag).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          phone: '01711111111',
          type: 'fake_order',
        }),
      );

      // Emits outbox event
      expect(outbox.enqueueEvent).toHaveBeenCalledWith(
        dummyTx,
        expect.objectContaining({
          type: 'order.cancelled',
          payload: { orderId: 'ord_3', cancelledBy: 'staff_1', reason: 'fake_order' },
        }),
      );
    });

    it('does not restock if stock was not sold on placement', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_4',
        orderNumber: 'AUR-004',
        status: 'placed',
        phone: '01711111111',
      } as unknown as FoundOrder);

      vi.mocked(inventory.hasSoldStock).mockResolvedValue(false);
      vi.mocked(inventory.hasRestockedStock).mockResolvedValue(false);

      vi.mocked(repo.updateOrder).mockResolvedValue({
        id: 'ord_4',
        orderNumber: 'AUR-004',
        status: 'cancelled',
      } as unknown as UpdatedOrder);

      await cancelOrder(dummyTx, {
        orderId: 'ord_4',
        staffId: 'staff_1',
        reason: 'customer_cancelled',
      });

      expect(inventory.releaseReservation).toHaveBeenCalled();
      expect(inventory.restock).not.toHaveBeenCalled();
      expect(repo.createRiskFlag).not.toHaveBeenCalled();
    });

    it('is idempotent if order is already cancelled', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'ord_5',
        orderNumber: 'AUR-005',
        status: 'cancelled',
      } as unknown as FoundOrder);

      const result = await cancelOrder(dummyTx, {
        orderId: 'ord_5',
        staffId: 'staff_1',
        reason: 'customer_cancelled',
      });

      expect(result.status).toBe('cancelled');
      expect(repo.updateOrder).not.toHaveBeenCalled();
    });
  });
});
