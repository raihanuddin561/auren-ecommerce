import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import * as inventory from '@/modules/inventory/service';
import { requestRefundForCancellation } from '@/modules/payments/refunds';
import { getVerificationSettings } from '@/modules/settings/service';
import type { VerificationSettings } from '@/modules/settings/schemas';
import * as repo from './repository';
import { FAILED_CONTACT_OUTCOMES, claimIsActive, needsManagerReview } from './sla';
import { CANCELLABLE_STATUSES, VERIFICATION_STATUSES } from './state-machine';
import { transitionOrder } from './transitions';
import {
  isChecklistComplete,
  type HoldOutcome,
  type OrderCancelReason,
  type VerificationChannelId,
  type VerificationChecklist,
} from './schemas';
import type { OrderStatus } from './timeline';

/**
 * Staff verification of an order (ARCHITECTURE section 6.1, ADR-015). This file is the ONLY way an
 * order becomes `confirmed` or `cancelled`: a staff member acts, the actor is read from the session
 * by the caller (never from input, INV-O9), and every step is an attempt row, a timeline row, an
 * audit row and an outbox event in one transaction. There is no automatic confirmation, no bulk
 * confirm, and nothing here (or anywhere) cancels an order on a timer (INV-O1, INV-O2).
 */

export interface Verifier {
  /** staff_members.id */
  staffId: string;
  /** users.id (the audit trail names the account) */
  userId: string;
  /** May assign, reassign and take over a claimed order. */
  manager: boolean;
  /** Which of the order permissions the person holds; the action layer fills these from the session. */
  canVerify: boolean;
  canCancel: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

type LockedOrder = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

async function loadLocked(tx: Tx, orderId: string): Promise<LockedOrder> {
  if (!(await repo.lockOrder(tx, orderId))) throw new DomainError('NOT_FOUND', 'Order not found');
  const order = await repo.findById(tx, orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  return order;
}

const isVerificationStatus = (status: string) =>
  (VERIFICATION_STATUSES as readonly string[]).includes(status);

const timeText = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Dhaka',
});

/**
 * An order can be acted on by its assignee, by anyone when it is unassigned or its claim ran out,
 * and by a manager. A manager's assignment (no expiry) holds until the manager changes it.
 */
export async function assertCanAct(
  tx: Tx,
  order: Pick<LockedOrder, 'assignedTo' | 'claimExpiresAt'>,
  verifier: Verifier,
  now: Date,
): Promise<void> {
  if (!order.assignedTo || order.assignedTo === verifier.staffId || verifier.manager) return;
  if (order.claimExpiresAt && !claimIsActive(order.claimExpiresAt, now)) return;
  const [holder] = await repo.staffNames(tx, [order.assignedTo]);
  const who = holder?.user.name ?? 'Another team member';
  throw new DomainError(
    'CONFLICT',
    order.claimExpiresAt
      ? `${who} is verifying this order until ${timeText.format(order.claimExpiresAt)}.`
      : `This order is assigned to ${who}.`,
  );
}

const toAttemptOutcome = (reason: OrderCancelReason) =>
  reason === 'fake_order' ? ('suspected_fake' as const) : ('customer_cancelled' as const);

// ---------------------------------------------------------------------------------------------
// Claim, release, assign
// ---------------------------------------------------------------------------------------------

export async function claimOrder(tx: Tx, input: { orderId: string; verifier: Verifier }) {
  const { verifier } = input;
  const settings = await getVerificationSettings(tx);
  const order = await loadLocked(tx, input.orderId);
  const status = order.status as OrderStatus;
  if (!isVerificationStatus(status)) {
    throw new DomainError('CONFLICT', 'This order is no longer waiting for verification.');
  }
  const now = new Date();
  await assertCanAct(tx, order, verifier, now);
  const claimExpiresAt = new Date(now.getTime() + settings.claimMinutes * 60_000);
  const data = {
    assignedTo: verifier.staffId,
    assignedAt: now,
    claimExpiresAt,
  };
  if (status === 'under_verification') {
    await repo.patchOrder(tx, order.id, data);
  } else {
    await transitionOrder(tx, {
      orderId: order.id,
      from: status,
      to: 'under_verification',
      actor: 'staff',
      staffId: verifier.staffId,
      data,
      eventType: 'claimed',
    });
  }
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.claim',
    entity: 'order',
    entityId: order.id,
    before: { assignedTo: order.assignedTo },
    after: { assignedTo: verifier.staffId, claimExpiresAt },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return { orderId: order.id, claimExpiresAt };
}

export async function releaseOrder(tx: Tx, input: { orderId: string; verifier: Verifier }) {
  const { verifier } = input;
  const order = await loadLocked(tx, input.orderId);
  const status = order.status as OrderStatus;
  if (status !== 'under_verification') return { orderId: order.id, status };
  if (order.assignedTo && order.assignedTo !== verifier.staffId && !verifier.manager) {
    throw new DomainError('FORBIDDEN', 'Only the person verifying this order can release it.');
  }
  // An order that was already tried goes back on hold; a fresh one goes back to the queue.
  const to: OrderStatus = order.verificationAttempts > 0 ? 'on_hold' : 'placed';
  await transitionOrder(tx, {
    orderId: order.id,
    from: status,
    to,
    actor: 'staff',
    staffId: verifier.staffId,
    data: { assignedTo: null, assignedAt: null, claimExpiresAt: null },
    eventType: 'released',
  });
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.release',
    entity: 'order',
    entityId: order.id,
    before: { assignedTo: order.assignedTo },
    after: { assignedTo: null },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return { orderId: order.id, status: to };
}

export async function assignOrder(
  tx: Tx,
  input: { orderId: string; assigneeId: string; verifier: Verifier },
) {
  const { verifier } = input;
  if (!verifier.manager) {
    throw new DomainError('FORBIDDEN', 'Only a manager can assign orders to someone else.');
  }
  const eligible = await repo.eligibleVerifier(tx, input.assigneeId);
  if (!eligible) {
    throw new DomainError('VALIDATION', 'That person cannot verify orders.', {
      fieldErrors: { assigneeId: ['Choose someone who is allowed to verify orders.'] },
    });
  }
  const order = await loadLocked(tx, input.orderId);
  const status = order.status as OrderStatus;
  if (!isVerificationStatus(status)) {
    throw new DomainError('CONFLICT', 'This order is no longer waiting for verification.');
  }
  const data = { assignedTo: input.assigneeId, assignedAt: new Date(), claimExpiresAt: null };
  if (status === 'under_verification') {
    await repo.patchOrder(tx, order.id, data);
    await repo.insertEvent(tx, {
      orderId: order.id,
      type: 'assigned',
      actorId: verifier.staffId,
      payload: { assignedTo: input.assigneeId },
    });
  } else {
    await transitionOrder(tx, {
      orderId: order.id,
      from: status,
      to: 'under_verification',
      actor: 'staff',
      staffId: verifier.staffId,
      data,
      eventType: 'assigned',
      payload: { assignedTo: input.assigneeId },
    });
  }
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.assign',
    entity: 'order',
    entityId: order.id,
    before: { assignedTo: order.assignedTo },
    after: { assignedTo: input.assigneeId },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return { orderId: order.id };
}

// ---------------------------------------------------------------------------------------------
// Outcomes: confirm, call back later, cancel
// ---------------------------------------------------------------------------------------------

export interface ConfirmOrderInput {
  orderId: string;
  checklist: VerificationChecklist;
  channel: VerificationChannelId;
  note?: string | null | undefined;
  verifier: Verifier;
}

/**
 * Confirms an order after staff verification (ADR-015, INV-O1, INV-O9). The whole checklist must be
 * ticked, the order must be open and not locked by someone else, and `confirmed_by` is the signed-in
 * staff member. The database independently refuses a confirmed order without a verifier who may verify.
 */
export async function confirmOrder(tx: Tx, input: ConfirmOrderInput) {
  const { verifier } = input;
  const settings = await getVerificationSettings(tx);
  const order = await loadLocked(tx, input.orderId);
  if (order.status === 'confirmed') {
    return { orderId: order.id, orderNumber: order.orderNumber, status: 'confirmed' as const };
  }
  const status = order.status as OrderStatus;
  if (!isVerificationStatus(status)) {
    throw new DomainError(
      'CONFLICT',
      `Cannot confirm an order that is ${status.replaceAll('_', ' ')}. Only orders waiting for verification can be confirmed.`,
    );
  }
  if (!isChecklistComplete(input.checklist)) {
    throw new DomainError('VALIDATION', 'Tick every point of the checklist before confirming.', {
      fieldErrors: { checklist: ['Every checklist point must be confirmed.'] },
    });
  }
  const now = new Date();
  await assertCanAct(tx, order, verifier, now);
  assertSelfVerifyAllowed(order, verifier, settings);

  await repo.insertAttempt(tx, {
    orderId: order.id,
    staffId: verifier.staffId,
    channel: input.channel,
    outcome: 'verified',
    checklist: input.checklist,
    note: input.note ?? null,
  });
  await transitionOrder(tx, {
    orderId: order.id,
    from: status,
    to: 'confirmed',
    actor: 'staff',
    staffId: verifier.staffId,
    data: {
      confirmedBy: verifier.staffId,
      confirmedAt: now,
      needsManagerReview: false,
      nextAttemptAt: null,
      claimExpiresAt: null,
    },
    payload: { note: input.note ?? 'Verified and confirmed by staff' },
  });
  await enqueueEvent(tx, {
    type: 'order.confirmed',
    aggregateType: 'order',
    aggregateId: order.id,
    payload: { orderId: order.id, confirmedBy: verifier.staffId },
  });
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.confirm',
    entity: 'order',
    entityId: order.id,
    before: { status },
    after: { status: 'confirmed', confirmedBy: verifier.staffId, checklist: input.checklist },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return { orderId: order.id, orderNumber: order.orderNumber, status: 'confirmed' as const };
}

/** A manual order needs a second person unless the owner switched self-verification on (6.5). */
function assertSelfVerifyAllowed(
  order: Pick<LockedOrder, 'channel' | 'createdBy'>,
  verifier: Verifier,
  settings: VerificationSettings,
): void {
  if (
    order.channel !== 'web' &&
    order.createdBy &&
    order.createdBy === verifier.staffId &&
    !settings.manualOrdersSelfVerify
  ) {
    throw new DomainError(
      'FORBIDDEN',
      'You entered this order yourself, so a different team member must verify it.',
    );
  }
}

export interface HoldOrderInput {
  orderId: string;
  outcome: HoldOutcome;
  channel: VerificationChannelId;
  note?: string | null | undefined;
  nextAttemptAt?: Date | null | undefined;
  verifier: Verifier;
}

/**
 * Logs a contact attempt that did not finish the job (no answer, busy, wrong number, call me later)
 * and puts the order on hold with the time to try again. After the configured number of failed
 * attempts the order is flagged for a manager; it is never cancelled (INV-O2).
 */
export async function holdOrder(tx: Tx, input: HoldOrderInput) {
  const { verifier } = input;
  const settings = await getVerificationSettings(tx);
  const order = await loadLocked(tx, input.orderId);
  const status = order.status as OrderStatus;
  if (!isVerificationStatus(status)) {
    throw new DomainError(
      'CONFLICT',
      `Cannot put an order that is ${status.replaceAll('_', ' ')} on hold.`,
    );
  }
  const now = new Date();
  await assertCanAct(tx, order, verifier, now);
  if (input.nextAttemptAt && input.nextAttemptAt.getTime() < now.getTime() - 60_000) {
    throw new DomainError('VALIDATION', 'Choose a time in the future to call back.', {
      fieldErrors: { nextAttemptAt: ['Choose a time in the future.'] },
    });
  }

  await repo.insertAttempt(tx, {
    orderId: order.id,
    staffId: verifier.staffId,
    channel: input.channel,
    outcome: input.outcome,
    note: input.note ?? null,
    nextAttemptAt: input.nextAttemptAt ?? null,
  });
  const failed = await repo.countAttempts(tx, order.id, FAILED_CONTACT_OUTCOMES);
  const flag = needsManagerReview(failed, settings.attemptThreshold) && !order.needsManagerReview;

  const data = {
    verificationAttempts: { increment: 1 },
    nextAttemptAt: input.nextAttemptAt ?? null,
    assignedTo: null,
    assignedAt: null,
    claimExpiresAt: null,
    ...(flag ? { needsManagerReview: true, escalatedAt: now } : {}),
  };
  if (status === 'on_hold') {
    await repo.patchOrder(tx, order.id, data);
    await repo.insertEvent(tx, {
      orderId: order.id,
      type: 'attempt',
      actorId: verifier.staffId,
      payload: { outcome: input.outcome, note: input.note ?? null },
    });
  } else {
    await transitionOrder(tx, {
      orderId: order.id,
      from: status,
      to: 'on_hold',
      actor: 'staff',
      staffId: verifier.staffId,
      data,
      payload: { outcome: input.outcome, note: input.note ?? null },
    });
  }
  if (flag) {
    await enqueueEvent(tx, {
      type: 'order.escalated',
      aggregateType: 'order',
      aggregateId: order.id,
      payload: { orderId: order.id, reason: 'failed_attempts' },
    });
  }
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.hold',
    entity: 'order',
    entityId: order.id,
    before: { status, attempts: order.verificationAttempts },
    after: {
      status: 'on_hold',
      attempts: order.verificationAttempts + 1,
      outcome: input.outcome,
      needsManagerReview: flag || order.needsManagerReview,
    },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: 'on_hold' as const,
    needsManagerReview: flag || order.needsManagerReview,
  };
}

export interface CancelOrderInput {
  orderId: string;
  reason: OrderCancelReason;
  note?: string | null | undefined;
  verifier: Verifier;
}

/**
 * Cancels an order on a staff decision with a required reason (INV-O2). Stock held for the order
 * goes back exactly as far as it is still out; a paid order gets a refund REQUEST that staff then
 * process through the normal refund controls; a fake order flags the phone.
 */
export async function cancelOrder(tx: Tx, input: CancelOrderInput) {
  const { verifier } = input;
  const order = await loadLocked(tx, input.orderId);
  if (order.status === 'cancelled') {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'cancelled' as const,
      refundRequested: false,
      tags: [] as string[],
    };
  }
  const status = order.status as OrderStatus;
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(status)) {
    throw new DomainError(
      'CONFLICT',
      `Cannot cancel an order that is ${status.replaceAll('_', ' ')}.`,
    );
  }
  const inVerification = isVerificationStatus(status);
  if (inVerification ? !verifier.canVerify : !verifier.canCancel) {
    throw new DomainError('FORBIDDEN');
  }
  const now = new Date();
  if (inVerification) await assertCanAct(tx, order, verifier, now);
  if (await repo.hasLiveShipment(tx, order.id)) {
    throw new DomainError(
      'CONFLICT',
      'A parcel is booked for this order. Cancel the shipment first, then cancel the order.',
    );
  }

  // Give back what the order still holds: reservations first, then units already sold.
  const tags = new Set<string>();
  const released = await inventory.releaseReservation(tx, {
    referenceType: 'order',
    referenceId: order.id,
    reason: input.reason,
    actorId: verifier.userId,
  });
  for (const tag of released.tags) tags.add(tag);
  const net = await inventory.netSoldStock(tx, 'order', order.id);
  if (net.size > 0) {
    const restocked = await inventory.restock(tx, {
      referenceType: 'order',
      referenceId: order.id,
      lines: [...net].map(([variantId, quantity]) => ({ variantId, quantity })),
      reason: `order_cancelled:${input.reason}`,
      actorId: verifier.userId,
    });
    for (const tag of restocked.tags) tags.add(tag);
  }

  if (input.reason === 'fake_order') {
    await repo.createRiskFlag(tx, {
      phone: order.phone,
      userId: order.userId,
      type: 'fake_order',
      note: input.note ?? 'Flagged as fake order during staff verification',
      createdBy: verifier.staffId,
    });
  }
  await repo.insertAttempt(tx, {
    orderId: order.id,
    staffId: verifier.staffId,
    channel: 'call',
    outcome: toAttemptOutcome(input.reason),
    note: input.note ?? null,
  });
  const refundId = await requestRefundForCancellation(tx, {
    orderId: order.id,
    reason: input.reason,
    staffId: verifier.staffId,
  });

  await transitionOrder(tx, {
    orderId: order.id,
    from: status,
    to: 'cancelled',
    actor: 'staff',
    staffId: verifier.staffId,
    data: {
      cancelledBy: verifier.staffId,
      cancelledAt: now,
      cancelReason: input.reason,
      cancelNote: input.note ?? null,
      claimExpiresAt: null,
      nextAttemptAt: null,
    },
    payload: { reason: input.reason, ...(refundId ? { refundRequested: true } : {}) },
  });
  await enqueueEvent(tx, {
    type: 'order.cancelled',
    aggregateType: 'order',
    aggregateId: order.id,
    payload: { orderId: order.id, cancelledBy: verifier.staffId, reason: input.reason },
  });
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.cancel',
    entity: 'order',
    entityId: order.id,
    before: { status },
    after: { status: 'cancelled', reason: input.reason, refundRequested: Boolean(refundId) },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: 'cancelled' as const,
    refundRequested: Boolean(refundId),
    tags: [...tags],
  };
}

// ---------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------

export async function addNote(
  tx: Tx,
  input: { orderId: string; note: string; verifier: Pick<Verifier, 'staffId' | 'userId'> },
) {
  if (!(await repo.lockOrder(tx, input.orderId))) {
    throw new DomainError('NOT_FOUND', 'Order not found');
  }
  await repo.insertEvent(tx, {
    orderId: input.orderId,
    type: 'note',
    actorId: input.verifier.staffId,
    payload: { note: input.note },
  });
  await audit(tx, {
    actorId: input.verifier.userId,
    action: 'order.note',
    entity: 'order',
    entityId: input.orderId,
    after: { length: input.note.length },
  });
}

// ---------------------------------------------------------------------------------------------
// Entry points (each is one transaction)
// ---------------------------------------------------------------------------------------------

export const claimOrderStaff = (input: Parameters<typeof claimOrder>[1]) =>
  db.$transaction((tx) => claimOrder(tx, input));
export const releaseOrderStaff = (input: Parameters<typeof releaseOrder>[1]) =>
  db.$transaction((tx) => releaseOrder(tx, input));
export const assignOrderStaff = (input: Parameters<typeof assignOrder>[1]) =>
  db.$transaction((tx) => assignOrder(tx, input));
export const confirmOrderStaff = (input: ConfirmOrderInput) =>
  db.$transaction((tx) => confirmOrder(tx, input));
export const holdOrderStaff = (input: HoldOrderInput) =>
  db.$transaction((tx) => holdOrder(tx, input));
export const cancelOrderStaff = (input: CancelOrderInput) =>
  db.$transaction((tx) => cancelOrder(tx, input));
export const addNoteStaff = (input: Parameters<typeof addNote>[1]) =>
  db.$transaction((tx) => addNote(tx, input));
