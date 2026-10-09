import type { Tx } from '@/lib/db';

export const insertPayment = (
  tx: Tx,
  data: {
    orderId: string;
    provider: string;
    method: string;
    amountMinor: bigint;
    currency: string;
    status: 'pending' | 'initiated';
    idempotencyKey: string;
  },
) => tx.payment.create({ data });

// ---------------------------------------------------------------------------------------------
// Money recorded against an order: collection and refunds
// ---------------------------------------------------------------------------------------------

/** Locks the order row and reads the money fields. Payment status and paid and refunded amounts belong to payments. */
export async function lockOrderMoney(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      user_id: string | null;
      currency: string;
      total_minor: bigint;
      paid_minor: bigint;
      refunded_minor: bigint;
      payment_status: string;
      status: string;
    }>
  >`SELECT id, user_id, currency, total_minor, paid_minor, refunded_minor,
           payment_status::text AS payment_status, status::text AS status
      FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        userId: row.user_id,
        currency: row.currency,
        totalMinor: row.total_minor,
        paidMinor: row.paid_minor,
        refundedMinor: row.refunded_minor,
        paymentStatus: row.payment_status,
        status: row.status,
      }
    : null;
}

export const setOrderMoney = (
  tx: Tx,
  orderId: string,
  data: {
    paidMinor?: bigint;
    refundedMinor?: bigint;
    paymentStatus: 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  },
) =>
  tx.order.update({
    where: { id: orderId },
    data: {
      ...(data.paidMinor !== undefined ? { paidMinor: data.paidMinor } : {}),
      ...(data.refundedMinor !== undefined ? { refundedMinor: data.refundedMinor } : {}),
      paymentStatus: data.paymentStatus,
    },
  });

export const paymentsOfOrder = (tx: Tx, orderId: string) =>
  tx.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });

export const markPaymentSucceeded = (tx: Tx, id: string, paidAt: Date) =>
  tx.payment.update({ where: { id }, data: { status: 'succeeded', paidAt } });

export const insertRefund = (
  tx: Tx,
  data: {
    orderId: string;
    paymentId: string;
    returnRequestId?: string | null;
    amountMinor: bigint;
    currency: string;
    reason: string;
    method: 'original' | 'store_credit' | 'manual_bkash';
    status: 'requested' | 'succeeded';
    note?: string | null;
    providerRef?: string | null;
    requestedBy?: string | null;
    actorId?: string | null;
    processedAt?: Date | null;
    idempotencyKey?: string | null;
  },
) =>
  tx.refund.create({
    data: {
      orderId: data.orderId,
      paymentId: data.paymentId,
      returnRequestId: data.returnRequestId ?? null,
      amountMinor: data.amountMinor,
      currency: data.currency,
      reason: data.reason,
      method: data.method,
      status: data.status,
      note: data.note ?? null,
      providerRef: data.providerRef ?? null,
      requestedBy: data.requestedBy ?? null,
      actorId: data.actorId ?? null,
      processedAt: data.processedAt ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
    },
  });

export const findRefundByKey = (tx: Tx, idempotencyKey: string) =>
  tx.refund.findUnique({ where: { idempotencyKey } });

export const lockRefund = async (tx: Tx, id: string) => {
  await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.refund.findUnique({ where: { id } });
};

export const completeRefund = (
  tx: Tx,
  id: string,
  data: {
    method: 'original' | 'store_credit' | 'manual_bkash';
    actorId: string;
    processedAt: Date;
    note?: string | null;
    providerRef?: string | null;
    idempotencyKey?: string | null;
  },
) =>
  tx.refund.update({
    where: { id },
    data: {
      status: 'succeeded',
      method: data.method,
      actorId: data.actorId,
      processedAt: data.processedAt,
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.providerRef !== undefined ? { providerRef: data.providerRef } : {}),
      ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
    },
  });

export const cancelRefundRow = (tx: Tx, id: string, actorId: string, note: string | null) =>
  tx.refund.update({
    where: { id },
    data: { status: 'cancelled', actorId, ...(note ? { note } : {}) },
  });

/** Refunds still waiting for staff (cancelled paid orders, approved returns). */
export const openRefundsAmount = async (tx: Tx, orderId: string): Promise<bigint> => {
  const sum = await tx.refund.aggregate({
    where: { orderId, status: 'requested' },
    _sum: { amountMinor: true },
  });
  return sum._sum.amountMinor ?? 0n;
};

export const listRefunds = (tx: Tx, orderId: string) =>
  tx.refund.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

export const insertStoreCredit = (
  tx: Tx,
  data: {
    userId: string;
    amountMinor: bigint;
    currency: string;
    reason: 'return' | 'goodwill' | 'redeem';
    referenceId: string;
    actorId: string;
  },
) => tx.storeCreditEntry.create({ data });

export const insertOrderEvent = (
  tx: Tx,
  data: { orderId: string; type: string; actorId?: string | null; payload: Record<string, string> },
) =>
  tx.orderEvent.create({
    data: {
      orderId: data.orderId,
      type: data.type,
      actorId: data.actorId ?? null,
      payload: data.payload,
    },
  });
