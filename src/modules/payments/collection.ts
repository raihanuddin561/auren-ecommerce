import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import * as repo from './repository';

/**
 * Cash on delivery collection (5.4, 5.5 for what a COD order can do). The payment row stays
 * `pending` while the parcel travels; the money becomes real when the courier delivers, so the
 * payment succeeds and the order is marked paid at delivery, never before. Safe to call twice.
 */
export async function recordCodCollected(
  tx: Tx,
  input: { orderId: string; at: Date },
): Promise<{ collectedMinor: bigint; alreadyCollected: boolean }> {
  const order = await repo.lockOrderMoney(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  const payments = await repo.paymentsOfOrder(tx, input.orderId);
  const cod = payments.find((payment) => payment.provider === 'cod');
  if (!cod) return { collectedMinor: 0n, alreadyCollected: false };
  if (cod.status === 'succeeded')
    return { collectedMinor: cod.amountMinor, alreadyCollected: true };
  await repo.markPaymentSucceeded(tx, cod.id, input.at);
  // The collected amount is the order total at delivery (it cannot change after confirmation).
  await repo.setOrderMoney(tx, input.orderId, {
    paidMinor: order.totalMinor,
    paymentStatus: order.refundedMinor > 0n ? 'partially_refunded' : 'paid',
  });
  return { collectedMinor: order.totalMinor, alreadyCollected: false };
}
