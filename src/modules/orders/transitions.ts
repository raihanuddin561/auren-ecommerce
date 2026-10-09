import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import * as repo from './repository';
import { assertTransition, type TransitionActor } from './state-machine';
import type { OrderStatus } from './timeline';

/**
 * The one place an order's status is written (ARCHITECTURE section 6). Every move:
 *  - is checked against the state machine, with the actor kind (a system actor can never confirm or
 *    cancel, INV-O1, INV-O2);
 *  - is a compare and set on the status the caller read, so two people acting at once cannot both win;
 *  - writes an `order_events` row and an `order.status_changed` outbox event in the same transaction.
 *
 * Callers lock the order first (`repo.lockOrder`) and pass the extra columns that belong to the
 * move (confirmed_by, shipped_at ...). Nothing outside this module and `verification.ts` writes
 * `orders.status` (a test scans the source for it).
 */

export interface TransitionInput {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actor: TransitionActor;
  /** staff_members.id of the person acting; required for a staff move. */
  staffId?: string | null;
  /** Columns that go with the move. Never `status` itself. */
  data?: Prisma.OrderUncheckedUpdateManyInput;
  /** Timeline row type; defaults to `status_changed`. */
  eventType?: string;
  /** Extra detail for the timeline row. Staff notes may appear here; no personal data in events. */
  payload?: Prisma.InputJsonObject;
}

export async function transitionOrder(tx: Tx, input: TransitionInput): Promise<void> {
  assertTransition(input.from, input.to, input.actor);
  if (input.actor === 'staff' && !input.staffId) {
    throw new DomainError('INTERNAL', 'A staff move needs the staff member.');
  }
  const moved = await repo.setStatus(tx, input.orderId, input.from, {
    ...input.data,
    status: input.to,
  });
  if (!moved) {
    throw new DomainError(
      'CONFLICT',
      'This order was just changed by someone else. Reload it and try again.',
    );
  }
  await repo.insertEvent(tx, {
    orderId: input.orderId,
    type: input.eventType ?? 'status_changed',
    fromStatus: input.from,
    toStatus: input.to,
    actorId: input.staffId ?? null,
    payload: input.payload ?? {},
  });
  await enqueueEvent(tx, {
    type: 'order.status_changed',
    aggregateType: 'order',
    aggregateId: input.orderId,
    payload: {
      orderId: input.orderId,
      from: input.from,
      to: input.to,
      ...(input.staffId ? { actorId: input.staffId } : {}),
    },
  });
}
