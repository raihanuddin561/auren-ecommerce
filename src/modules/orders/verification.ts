import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import * as inventory from '@/modules/inventory/service';
import * as repo from './repository';
import type { OrderCancelReason } from './schemas';

export interface ConfirmOrderInput {
  orderId: string;
  staffId: string;
  note?: string | null;
}

export interface HoldOrderInput {
  orderId: string;
  staffId: string;
  note?: string | null;
  nextAttemptAt?: Date | null;
}

export interface CancelOrderInput {
  orderId: string;
  staffId: string;
  reason: OrderCancelReason;
  note?: string | null;
}

/**
 * Confirms an order after staff verification (ADR-015, INV-O1, INV-O9).
 * Sets status to 'confirmed', assigns confirmed_by and confirmed_at,
 * creates timeline and audit events, and enqueues domain event.
 */
export async function confirmOrder(tx: Tx, input: ConfirmOrderInput) {
  const order = await repo.findById(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');

  if (order.status === 'confirmed') {
    return { orderId: order.id, orderNumber: order.orderNumber, status: 'confirmed' as const };
  }

  const verifiableStatuses = ['placed', 'under_verification', 'on_hold'];
  if (!verifiableStatuses.includes(order.status)) {
    throw new DomainError(
      'CONFLICT',
      `Cannot confirm order in status "${order.status}". Only open orders awaiting verification can be confirmed.`,
    );
  }

  const updated = await repo.updateOrder(tx, input.orderId, {
    status: 'confirmed',
    verifier: { connect: { id: input.staffId } },
    confirmedAt: new Date(),
  });

  await repo.insertEvent(tx, {
    orderId: input.orderId,
    type: 'status_changed',
    fromStatus: order.status,
    toStatus: 'confirmed',
    actorId: input.staffId,
    payload: { note: input.note ?? 'Order verified and confirmed by staff' },
  });

  await enqueueEvent(tx, {
    type: 'order.confirmed',
    aggregateType: 'order',
    aggregateId: input.orderId,
    payload: {
      orderId: input.orderId,
      confirmedBy: input.staffId,
    },
  });

  await audit(tx, {
    actorId: input.staffId,
    action: 'order.confirm',
    entity: 'order',
    entityId: input.orderId,
    before: { status: order.status },
    after: { status: 'confirmed', confirmedBy: input.staffId },
  });

  return { orderId: updated.id, orderNumber: updated.orderNumber, status: 'confirmed' as const };
}

/**
 * Places an order on hold when customer is unreachable or call-back is scheduled.
 */
export async function holdOrder(tx: Tx, input: HoldOrderInput) {
  const order = await repo.findById(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');

  const holdableStatuses = ['placed', 'under_verification', 'on_hold'];
  if (!holdableStatuses.includes(order.status)) {
    throw new DomainError('CONFLICT', `Cannot hold order in status "${order.status}".`);
  }

  const updated = await repo.updateOrder(tx, input.orderId, {
    status: 'on_hold',
    verificationAttempts: { increment: 1 },
    nextAttemptAt: input.nextAttemptAt ?? null,
  });

  await repo.insertEvent(tx, {
    orderId: input.orderId,
    type: 'status_changed',
    fromStatus: order.status,
    toStatus: 'on_hold',
    actorId: input.staffId,
    payload: { note: input.note ?? 'Customer unreachable / call-back scheduled' },
  });

  await audit(tx, {
    actorId: input.staffId,
    action: 'order.hold',
    entity: 'order',
    entityId: input.orderId,
    before: { status: order.status, attempts: order.verificationAttempts },
    after: { status: 'on_hold', attempts: order.verificationAttempts + 1 },
  });

  return { orderId: updated.id, orderNumber: updated.orderNumber, status: 'on_hold' as const };
}

/**
 * Cancels an order with a required reason.
 * Automatically restocks deducted inventory and cancels reservations (INV-O2, INV-S3).
 * Flags the phone number if fake_order.
 */
export async function cancelOrder(tx: Tx, input: CancelOrderInput) {
  const order = await repo.findById(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');

  if (order.status === 'cancelled') {
    return { orderId: order.id, orderNumber: order.orderNumber, status: 'cancelled' as const };
  }

  const nonCancellable = ['shipped', 'delivered', 'completed', 'returned_to_origin'];
  if (nonCancellable.includes(order.status)) {
    throw new DomainError('CONFLICT', `Cannot cancel order in status "${order.status}".`);
  }

  // Release any active stock reservations
  await inventory.releaseReservation(tx, {
    referenceType: 'order',
    referenceId: input.orderId,
    reason: input.reason,
    actorId: input.staffId,
  });

  // Restock inventory only if stock was actually sold on placement and not already restocked
  const sold = await inventory.hasSoldStock(tx, 'order', input.orderId);
  const restocked = await inventory.hasRestockedStock(tx, 'order', input.orderId);
  if (sold && !restocked) {
    const items = await repo.findOrderItems(tx, input.orderId);
    if (items.length > 0) {
      await inventory.restock(tx, {
        referenceType: 'order',
        referenceId: input.orderId,
        lines: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        reason: input.reason,
        actorId: input.staffId,
      });
    }
  }

  // Flag customer phone if fraudulent
  if (input.reason === 'fake_order') {
    await repo.createRiskFlag(tx, {
      phone: order.phone,
      userId: order.userId,
      type: 'fake_order',
      note: input.note ?? 'Flagged as fake order during staff verification',
      createdBy: input.staffId,
    });
  }

  const updated = await repo.updateOrder(tx, input.orderId, {
    status: 'cancelled',
    canceller: { connect: { id: input.staffId } },
    cancelledAt: new Date(),
    cancelReason: input.reason,
    cancelNote: input.note ?? null,
  });

  await repo.insertEvent(tx, {
    orderId: input.orderId,
    type: 'status_changed',
    fromStatus: order.status,
    toStatus: 'cancelled',
    actorId: input.staffId,
    payload: { reason: input.reason, note: input.note },
  });

  await enqueueEvent(tx, {
    type: 'order.cancelled',
    aggregateType: 'order',
    aggregateId: input.orderId,
    payload: {
      orderId: input.orderId,
      cancelledBy: input.staffId,
      reason: input.reason,
    },
  });

  await audit(tx, {
    actorId: input.staffId,
    action: 'order.cancel',
    entity: 'order',
    entityId: input.orderId,
    before: { status: order.status },
    after: { status: 'cancelled', reason: input.reason },
  });

  return { orderId: updated.id, orderNumber: updated.orderNumber, status: 'cancelled' as const };
}

export const confirmOrderStaff = (input: ConfirmOrderInput) =>
  db.$transaction((tx) => confirmOrder(tx, input));

export const holdOrderStaff = (input: HoldOrderInput) =>
  db.$transaction((tx) => holdOrder(tx, input));

export const cancelOrderStaff = (input: CancelOrderInput) =>
  db.$transaction((tx) => cancelOrder(tx, input));
