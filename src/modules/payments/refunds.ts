import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { fromDecimalString } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import type { StaffContext } from '@/lib/permissions';
import { requestApproval, requireApproval } from '@/modules/approvals/service';
import * as repo from './repository';

/**
 * Refunds (5.5). Money goes back only through a staff action with `orders.refund`, a fresh step-up
 * and, above the threshold, a second person's approval (INV-P4, INV-A6). A cancelled paid order
 * creates a `requested` refund that waits for that action; nothing is refunded automatically.
 *
 * There is no gateway for cash on delivery: a refund is recorded when staff send the money by
 * bKash or give store credit, and the record updates the order's payment status and totals. A
 * gateway adapter would send the money first and then call the same recording.
 */

export const REFUND_METHODS = ['original', 'store_credit', 'manual_bkash'] as const;
export type RefundMethodId = (typeof REFUND_METHODS)[number];

export interface RefundStaff {
  /** staff_members.id */
  staffId: string;
  /** users.id, for the audit trail. */
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** What can still go back: paid, minus what was refunded, minus what is already requested. */
export async function refundableMinor(tx: Tx, orderId: string): Promise<bigint> {
  const order = await repo.lockOrderMoney(tx, orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  return order.paidMinor - order.refundedMinor - (await repo.openRefundsAmount(tx, orderId));
}

/**
 * Creates the refund request that goes with cancelling an order that was paid. It is a to-do for
 * a person with `orders.refund`, not a refund. Returns null when nothing was paid (cash on
 * delivery cancelled before delivery).
 */
export async function requestRefundForCancellation(
  tx: Tx,
  input: { orderId: string; reason: string; staffId: string },
): Promise<string | null> {
  const order = await repo.lockOrderMoney(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  const open = await repo.openRefundsAmount(tx, input.orderId);
  const amount = order.paidMinor - order.refundedMinor - open;
  if (amount <= 0n) return null;
  const payments = await repo.paymentsOfOrder(tx, input.orderId);
  const payment = payments.find((p) => p.status === 'succeeded');
  if (!payment) return null;
  const refund = await repo.insertRefund(tx, {
    orderId: input.orderId,
    paymentId: payment.id,
    amountMinor: amount,
    currency: order.currency,
    reason: `Order cancelled: ${input.reason}`,
    method: 'manual_bkash',
    status: 'requested',
    requestedBy: input.staffId,
  });
  return refund.id;
}

export interface ProcessRefundInput {
  orderId: string;
  /** Amount in major units typed by staff ("1250.50"); converted by lib/money. Ignored when a requested refund is processed. */
  amount?: string;
  /** Process an existing request instead of creating a new refund. */
  refundId?: string;
  method: RefundMethodId;
  reason: string;
  note?: string | null;
  /** The bKash transaction id or any reference the staff member wants kept. */
  providerRef?: string | null;
  /** From the form: the same key never refunds twice. */
  idempotencyKey: string;
  returnRequestId?: string | null;
  staff: RefundStaff;
}

export interface ProcessedRefund {
  refundId: string;
  amountMinor: bigint;
  paymentStatus: 'partially_refunded' | 'refunded';
  replayed: boolean;
}

const moneyError = (field: string, message: string) =>
  new DomainError('VALIDATION', message, { fieldErrors: { [field]: [message] } });

/** Records a refund (full or partial) against a collected payment. Runs inside the caller's transaction. */
export async function processRefund(tx: Tx, input: ProcessRefundInput): Promise<ProcessedRefund> {
  const replay = await repo.findRefundByKey(tx, input.idempotencyKey);
  if (replay && replay.orderId === input.orderId && replay.status === 'succeeded') {
    const order = await repo.lockOrderMoney(tx, input.orderId);
    return {
      refundId: replay.id,
      amountMinor: replay.amountMinor,
      paymentStatus:
        order && order.refundedMinor >= order.paidMinor ? 'refunded' : 'partially_refunded',
      replayed: true,
    };
  }
  const order = await repo.lockOrderMoney(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  if (order.paidMinor <= 0n) {
    throw new DomainError(
      'CONFLICT',
      'Nothing has been paid on this order yet. For cash on delivery the money is collected at delivery.',
    );
  }

  let amount: bigint;
  let existing: Awaited<ReturnType<typeof repo.lockRefund>> = null;
  if (input.refundId) {
    existing = await repo.lockRefund(tx, input.refundId);
    if (!existing || existing.orderId !== input.orderId) {
      throw new DomainError('NOT_FOUND', 'Refund request not found');
    }
    if (existing.status !== 'requested') {
      throw new DomainError('CONFLICT', 'That refund request has already been dealt with.');
    }
    amount = existing.amountMinor;
  } else {
    if (!input.amount) throw moneyError('amount', 'Enter the amount to refund.');
    try {
      amount = fromDecimalString(input.amount, order.currency).minor;
    } catch {
      throw moneyError('amount', 'Enter an amount such as 1250 or 1250.50.');
    }
    if (amount <= 0n) throw moneyError('amount', 'The amount must be above zero.');
  }

  const open = (await repo.openRefundsAmount(tx, input.orderId)) - (existing?.amountMinor ?? 0n);
  const room = order.paidMinor - order.refundedMinor - open;
  if (amount > room) {
    throw moneyError('amount', 'That is more than can still be refunded on this order.');
  }
  if (input.method === 'store_credit' && !order.userId) {
    throw moneyError(
      'method',
      'Store credit needs a customer account; this order was placed as a guest.',
    );
  }

  // Maker-checker above the threshold (INV-A6): a second person must have approved this order's refund.
  await requireApproval(tx, {
    kind: 'refund',
    subjectType: 'order',
    subjectId: input.orderId,
    amountMinor: amount,
    currency: order.currency,
  });

  const payments = await repo.paymentsOfOrder(tx, input.orderId);
  const payment = existing
    ? payments.find((p) => p.id === existing.paymentId)
    : payments.find((p) => p.status === 'succeeded');
  if (!payment || payment.status !== 'succeeded') {
    throw new DomainError('CONFLICT', 'This order has no collected payment to refund.');
  }

  const now = new Date();
  const refund = existing
    ? await repo.completeRefund(tx, existing.id, {
        method: input.method,
        actorId: input.staff.staffId,
        processedAt: now,
        note: input.note ?? null,
        providerRef: input.providerRef ?? null,
        idempotencyKey: input.idempotencyKey,
      })
    : await repo.insertRefund(tx, {
        orderId: input.orderId,
        paymentId: payment.id,
        returnRequestId: input.returnRequestId ?? null,
        amountMinor: amount,
        currency: order.currency,
        reason: input.reason,
        method: input.method,
        status: 'succeeded',
        note: input.note ?? null,
        providerRef: input.providerRef ?? null,
        requestedBy: input.staff.staffId,
        actorId: input.staff.staffId,
        processedAt: now,
        idempotencyKey: input.idempotencyKey,
      });

  if (input.method === 'store_credit' && order.userId) {
    await repo.insertStoreCredit(tx, {
      userId: order.userId,
      amountMinor: amount,
      currency: order.currency,
      reason: 'return',
      referenceId: refund.id,
      actorId: input.staff.staffId,
    });
  }

  const refundedAfter = order.refundedMinor + amount;
  const paymentStatus = refundedAfter >= order.paidMinor ? 'refunded' : 'partially_refunded';
  await repo.setOrderMoney(tx, input.orderId, { refundedMinor: refundedAfter, paymentStatus });

  await repo.insertOrderEvent(tx, {
    orderId: input.orderId,
    type: 'refund',
    actorId: input.staff.staffId,
    payload: {
      refundId: refund.id,
      amountMinor: amount.toString(),
      method: input.method,
      paymentStatus,
    },
  });
  await audit(tx, {
    actorId: input.staff.userId,
    action: 'order.refund',
    entity: 'order',
    entityId: input.orderId,
    before: { refundedMinor: order.refundedMinor.toString(), paymentStatus: order.paymentStatus },
    after: {
      refundedMinor: refundedAfter.toString(),
      paymentStatus,
      refundId: refund.id,
      amountMinor: amount.toString(),
      method: input.method,
    },
    ip: input.staff.ip ?? null,
    userAgent: input.staff.userAgent ?? null,
  });
  await enqueueEvent(tx, {
    type: 'refund.processed',
    aggregateType: 'order',
    aggregateId: input.orderId,
    payload: { refundId: refund.id, orderId: input.orderId },
  });
  return { refundId: refund.id, amountMinor: amount, paymentStatus, replayed: false };
}

/** Staff decide not to go ahead with a refund request (for example it was created in error). Audited. */
export async function declineRefundRequest(
  tx: Tx,
  input: { refundId: string; orderId: string; note: string; staff: RefundStaff },
): Promise<void> {
  const refund = await repo.lockRefund(tx, input.refundId);
  if (!refund || refund.orderId !== input.orderId) {
    throw new DomainError('NOT_FOUND', 'Refund request not found');
  }
  if (refund.status !== 'requested') {
    throw new DomainError('CONFLICT', 'That refund request has already been dealt with.');
  }
  await repo.cancelRefundRow(tx, refund.id, input.staff.staffId, input.note);
  await audit(tx, {
    actorId: input.staff.userId,
    action: 'order.refund_decline',
    entity: 'order',
    entityId: input.orderId,
    after: { refundId: refund.id, note: input.note },
    ip: input.staff.ip ?? null,
    userAgent: input.staff.userAgent ?? null,
  });
}

/** Refunds of an order, oldest first, for the order page. */
export const listRefundsOfOrder = (tx: Tx, orderId: string) => repo.listRefunds(tx, orderId);

// Entry points (one transaction each). The caller checked the permission and the step-up. -------

export const refundOrderStaff = (input: ProcessRefundInput) =>
  db.$transaction((tx) => processRefund(tx, input));

export const declineRefundStaff = (input: Parameters<typeof declineRefundRequest>[1]) =>
  db.$transaction((tx) => declineRefundRequest(tx, input));

/** Asks a second person to approve a refund above the threshold (maker-checker). */
export const requestRefundApprovalStaff = (
  staff: StaffContext,
  input: { orderId: string; amountMinor: bigint; currency: string; reason: string },
) =>
  db.$transaction((tx) =>
    requestApproval(tx, staff, {
      kind: 'refund',
      subjectType: 'order',
      subjectId: input.orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      reason: input.reason,
    }),
  );
