import type { Tx } from '@/lib/db';

export const insertLog = (
  tx: Tx,
  data: {
    channel: 'email' | 'sms';
    template: string;
    toMasked: string;
    status: 'sent' | 'failed' | 'skipped';
    providerRef?: string | null;
    error?: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
  },
) =>
  tx.notificationLog.create({
    data: {
      channel: data.channel,
      template: data.template,
      toMasked: data.toMasked,
      status: data.status,
      providerRef: data.providerRef ?? null,
      error: data.error?.slice(0, 500) ?? null,
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ?? null,
    },
  });

export const countSent = (tx: Tx, template: string, relatedType: string, relatedId: string) =>
  tx.notificationLog.count({ where: { template, relatedType, relatedId, status: 'sent' } });

// ---------------------------------------------------------------------------------------------
// Read models for message copy (reads only; the modules that own the data write it)
// ---------------------------------------------------------------------------------------------

export const orderForMessage = (tx: Tx, orderId: string) =>
  tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      phone: true,
      email: true,
      currency: true,
      totalMinor: true,
      paidMinor: true,
      shippingMethod: true,
      shipments: {
        where: { kind: 'outbound' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { courier: true, courierName: true, trackingNumber: true },
      },
    },
  });

/** The total before and after the latest edit made while the order was being verified. */
export async function latestEditTotals(
  tx: Tx,
  orderId: string,
): Promise<{ before: bigint; after: bigint } | null> {
  const event = await tx.orderEvent.findFirst({
    where: { orderId, type: 'order_edited' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { payload: true },
  });
  const payload = event?.payload as { totalBeforeMinor?: string; totalAfterMinor?: string } | null;
  if (!payload?.totalBeforeMinor || !payload.totalAfterMinor) return null;
  return { before: BigInt(payload.totalBeforeMinor), after: BigInt(payload.totalAfterMinor) };
}

export const refundForMessage = (tx: Tx, refundId: string) =>
  tx.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      orderId: true,
      amountMinor: true,
      currency: true,
      method: true,
      status: true,
    },
  });

export const returnForMessage = (tx: Tx, returnId: string) =>
  tx.returnRequest.findUnique({
    where: { id: returnId },
    select: { id: true, orderId: true, returnNumber: true },
  });

/** Active owners, admins and managers: who hears about an order that waits too long. */
export const managerRecipients = (tx: Tx) =>
  tx.staffMember.findMany({
    where: { active: true, role: { in: ['owner', 'admin', 'manager'] } },
    select: { id: true, user: { select: { email: true } } },
  });
