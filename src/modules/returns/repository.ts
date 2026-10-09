import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

/** Data access for return and exchange requests. No business rules here. */

const detailInclude = {
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          variantId: true,
          productId: true,
          titleSnapshot: true,
          variantTitleSnapshot: true,
          skuSnapshot: true,
          unitPriceMinor: true,
          unitCostMinor: true,
          quantity: true,
          quantityReturned: true,
          imageSnapshot: true,
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      phone: true,
      email: true,
      userId: true,
      currency: true,
      deliveredAt: true,
      refundedMinor: true,
      paidMinor: true,
    },
  },
  refunds: { select: { id: true, amountMinor: true, status: true, method: true } },
} satisfies Prisma.ReturnRequestInclude;

export type ReturnDetail = NonNullable<Awaited<ReturnType<typeof findReturn>>>;

export const findReturn = (tx: Tx, id: string) =>
  tx.returnRequest.findUnique({ where: { id }, include: detailInclude });

export async function lockReturn(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM return_requests WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export const insertReturn = (
  tx: Tx,
  data: {
    orderId: string;
    type: 'return' | 'exchange';
    customerNote: string | null;
    currency: string;
    requestedBy: string;
    items: Array<{
      orderItemId: string;
      quantity: number;
      reason: 'too_small' | 'too_large' | 'defective' | 'not_as_described' | 'changed_mind';
      exchangeVariantId: string | null;
    }>;
  },
) =>
  tx.returnRequest.create({
    data: {
      orderId: data.orderId,
      type: data.type,
      customerNote: data.customerNote,
      currency: data.currency,
      requestedBy: data.requestedBy,
      items: { create: data.items },
    },
    select: { id: true, returnNumber: true },
  });

export const patchReturn = (tx: Tx, id: string, data: Prisma.ReturnRequestUncheckedUpdateInput) =>
  tx.returnRequest.update({ where: { id }, data });

export const setItemCondition = (tx: Tx, id: string, condition: 'resellable' | 'damaged') =>
  tx.returnItem.update({ where: { id }, data: { condition } });

export const addReturnedQuantity = (tx: Tx, orderItemId: string, quantity: number) =>
  tx.orderItem.update({
    where: { id: orderItemId },
    data: { quantityReturned: { increment: quantity } },
  });

/**
 * Units of each order line that are spoken for: returned already, or in a request that is still
 * open (so two requests cannot ask for the same unit).
 */
export async function unitsInOpenReturns(tx: Tx, orderId: string): Promise<Map<string, number>> {
  const rows = await tx.returnItem.groupBy({
    by: ['orderItemId'],
    where: {
      returnRequest: {
        orderId,
        status: { in: ['requested', 'approved', 'in_transit', 'received'] },
      },
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
}

export const orderLinesForReturn = (tx: Tx, orderId: string) =>
  tx.orderItem.findMany({
    where: { orderId, replacementOfItemId: null },
    select: {
      id: true,
      variantId: true,
      productId: true,
      titleSnapshot: true,
      variantTitleSnapshot: true,
      skuSnapshot: true,
      unitPriceMinor: true,
      quantity: true,
      quantityReturned: true,
      imageSnapshot: true,
    },
    orderBy: { createdAt: 'asc' },
  });

export const hasOtherOpenReturn = async (tx: Tx, orderId: string, exceptId: string) =>
  (await tx.returnRequest.count({
    where: {
      orderId,
      id: { not: exceptId },
      status: { in: ['requested', 'approved', 'in_transit', 'received', 'inspected'] },
    },
  })) > 0;

export const insertReplacementLines = (tx: Tx, data: Prisma.OrderItemCreateManyInput[]) =>
  tx.orderItem.createMany({ data });

export const listReturns = (
  tx: Tx,
  input: { statuses?: readonly string[]; skip: number; take: number },
) =>
  tx.returnRequest.findMany({
    where: input.statuses
      ? {
          status: {
            in: input.statuses as Array<
              | 'requested'
              | 'approved'
              | 'rejected'
              | 'in_transit'
              | 'received'
              | 'inspected'
              | 'refunded'
              | 'exchanged'
              | 'closed'
            >,
          },
        }
      : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: input.skip,
    take: input.take,
    select: {
      id: true,
      returnNumber: true,
      type: true,
      status: true,
      createdAt: true,
      currency: true,
      order: { select: { id: true, orderNumber: true, customerName: true } },
      _count: { select: { items: true } },
    },
  });

export const countReturns = (tx: Tx, statuses?: readonly string[]) =>
  tx.returnRequest.count({
    where: statuses ? { status: { in: statuses as never } } : {},
  });

export const returnsOfOrder = (tx: Tx, orderId: string) =>
  tx.returnRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: detailInclude,
  });

/** The order a customer wants to return from, locked for the request. */
export async function lockOrderForReturn(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  return tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, deliveredAt: true, currency: true },
  });
}

export const insertTimelineRow = (
  tx: Tx,
  data: { orderId: string; type: string; actorId: string | null; payload: Prisma.InputJsonObject },
) => tx.orderEvent.create({ data });
