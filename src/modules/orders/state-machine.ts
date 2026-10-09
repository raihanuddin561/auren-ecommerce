import { DomainError } from '@/lib/errors';
import type { OrderStatus } from './timeline';

/**
 * The order state machine (ARCHITECTURE section 6). Pure: no database, no clock.
 *
 * Two rules sit above the table of allowed moves (ADR-015, INV-O1, INV-O2):
 *  - `confirmed` is reachable only through staff verification, never by a job, webhook or any
 *    automatic path;
 *  - `cancelled` is reachable only by a staff member with a reason; the system never cancels.
 */

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['placed', 'payment_expired'],
  payment_expired: [],
  placed: ['under_verification', 'on_hold', 'confirmed', 'cancelled'],
  under_verification: ['placed', 'on_hold', 'confirmed', 'cancelled'],
  on_hold: ['under_verification', 'confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed'],
  // A failed delivery is either tried again or sent back to us.
  delivery_failed: ['shipped', 'delivered', 'returned_to_origin'],
  returned_to_origin: [],
  delivered: ['completed', 'return_requested'],
  completed: [],
  // A request that is rejected puts the order back to delivered.
  return_requested: ['returned', 'delivered'],
  // After inspection: the whole order is refunded or exchanged, or a part came back and the rest stays delivered.
  returned: ['refunded', 'exchanged', 'delivered'],
  refunded: [],
  exchanged: [],
  cancelled: [],
};

/** Statuses only a staff action may set. A system actor (job, webhook) can never write them. */
export const STAFF_ONLY_STATUSES: readonly OrderStatus[] = ['confirmed', 'cancelled'];

/** Who is making the move. */
export type TransitionActor = 'staff' | 'system';

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor = 'staff',
): boolean {
  if (actor === 'system' && STAFF_ONLY_STATUSES.includes(to)) return false;
  return TRANSITIONS[from].includes(to);
}

/** Throws INVALID_TRANSITION unless the move is allowed for this kind of actor. */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor = 'staff',
): void {
  if (actor === 'system' && STAFF_ONLY_STATUSES.includes(to)) {
    throw new DomainError('INVALID_TRANSITION', `Only a staff member can set an order to "${to}".`);
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `An order that is "${from.replaceAll('_', ' ')}" cannot become "${to.replaceAll('_', ' ')}".`,
    );
  }
}

/** Orders a person is still deciding on (the verification queue). */
export const VERIFICATION_STATUSES: readonly OrderStatus[] = [
  'placed',
  'under_verification',
  'on_hold',
];

/** Statuses from which staff can still cancel. */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = Object.entries(TRANSITIONS)
  .filter(([, targets]) => targets.includes('cancelled'))
  .map(([status]) => status as OrderStatus);
