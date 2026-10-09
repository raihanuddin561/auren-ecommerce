import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import * as repo from './repository';
import { transitionOrder } from './transitions';
import type { OrderStatus } from './timeline';

/**
 * How a return moves the order (ARCHITECTURE section 6): delivered, return_requested, returned,
 * then refunded, exchanged, or back to delivered when only part of the order came back. The returns
 * module calls these; it never writes an order status itself. None of them can confirm or cancel.
 */

export type ReturnActor = { kind: 'customer' } | { kind: 'staff'; staffId: string };

const actorFields = (actor: ReturnActor) =>
  actor.kind === 'staff'
    ? { actor: 'staff' as const, staffId: actor.staffId }
    : { actor: 'system' as const };

async function currentStatus(tx: Tx, orderId: string): Promise<OrderStatus> {
  if (!(await repo.lockOrder(tx, orderId))) throw new DomainError('NOT_FOUND', 'Order not found');
  const order = await repo.findById(tx, orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  return order.status as OrderStatus;
}

/** A customer or staff member opened a return: the order shows it. A second open request changes nothing. */
export async function markReturnRequested(
  tx: Tx,
  input: { orderId: string; returnNumber: string; actor: ReturnActor },
): Promise<void> {
  const from = await currentStatus(tx, input.orderId);
  if (from === 'return_requested') return;
  await transitionOrder(tx, {
    orderId: input.orderId,
    from,
    to: 'return_requested',
    ...actorFields(input.actor),
    eventType: 'return_requested',
    payload: { returnNumber: input.returnNumber },
  });
}

/** The request was rejected or closed with nothing else open: the order is delivered again. */
export async function reopenAsDelivered(
  tx: Tx,
  input: { orderId: string; returnNumber: string; actor: ReturnActor; otherOpenReturn: boolean },
): Promise<void> {
  const from = await currentStatus(tx, input.orderId);
  if (input.otherOpenReturn || (from !== 'return_requested' && from !== 'returned')) return;
  await transitionOrder(tx, {
    orderId: input.orderId,
    from,
    to: 'delivered',
    ...actorFields(input.actor),
    eventType: 'return_closed',
    payload: { returnNumber: input.returnNumber },
  });
}

/** The goods are back and inspected. */
export async function markReturned(
  tx: Tx,
  input: { orderId: string; returnNumber: string; actor: ReturnActor },
): Promise<void> {
  const from = await currentStatus(tx, input.orderId);
  if (from === 'returned') return;
  await transitionOrder(tx, {
    orderId: input.orderId,
    from,
    to: 'returned',
    ...actorFields(input.actor),
    eventType: 'returned',
    payload: { returnNumber: input.returnNumber },
  });
}

/**
 * The return is settled. When every unit of the order came back the order becomes refunded or
 * exchanged; when only part did, it goes back to delivered (the rest of the order stands).
 */
export async function settleReturn(
  tx: Tx,
  input: {
    orderId: string;
    returnNumber: string;
    outcome: 'refunded' | 'exchanged' | 'closed';
    actor: ReturnActor;
    otherOpenReturn: boolean;
  },
): Promise<OrderStatus> {
  const from = await currentStatus(tx, input.orderId);
  if (from !== 'returned') return from;
  const items = await repo.itemsWithVariant(tx, input.orderId);
  const sellable = items.filter((item) => item.replacementOfItemId === null);
  const everythingBack = sellable.every((item) => item.quantityReturned >= item.quantity);
  const to: OrderStatus =
    input.otherOpenReturn || !everythingBack || input.outcome === 'closed'
      ? 'delivered'
      : input.outcome === 'refunded'
        ? 'refunded'
        : 'exchanged';
  await transitionOrder(tx, {
    orderId: input.orderId,
    from,
    to,
    ...actorFields(input.actor),
    eventType: to === 'delivered' ? 'return_settled' : to,
    payload: { returnNumber: input.returnNumber, outcome: input.outcome },
  });
  return to;
}
