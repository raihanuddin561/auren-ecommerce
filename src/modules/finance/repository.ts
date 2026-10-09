import { randomUUID } from 'node:crypto';
import type { Tx } from '@/lib/db';

/**
 * Data access for order costs and order profit. The profit read joins order lines, returns, refunds
 * and cost lines on purpose: a report reads several tables, it never writes to the ones it does not own.
 */

import type { CostType } from './types';

export type { CostType };

export interface CostLineInsert {
  orderId: string;
  type: CostType;
  amountMinor: bigint;
  currency: string;
  sourceType?: string | null;
  sourceId?: string | null;
  note?: string | null;
  actorId?: string | null;
}

/**
 * Inserts a cost line. A line with a source is recorded once: the unique index on
 * (order, type, source type, source id) makes a second call a no-op. Returns whether it was written.
 */
export async function insertCostLine(tx: Tx, line: CostLineInsert): Promise<boolean> {
  const id = randomUUID();
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO order_cost_lines
      (id, order_id, type, amount_minor, currency, source_type, source_id, note, actor_id)
    VALUES
      (${id}::uuid, ${line.orderId}::uuid, ${line.type}::order_cost_type, ${line.amountMinor},
       ${line.currency}, ${line.sourceType ?? null}, ${line.sourceId ?? null},
       ${line.note ?? null}, ${line.actorId ?? null}::uuid)
    ON CONFLICT (order_id, type, source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
    RETURNING id`;
  return rows.length === 1;
}

export const listCostLines = (tx: Tx, orderId: string) =>
  tx.orderCostLine.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

/** What is already booked for one source (for example a parcel), summed per type. */
export async function sumCostBySource(
  tx: Tx,
  orderId: string,
  type: CostType,
  sourceType: string,
  sourceIdPrefix: string,
): Promise<bigint> {
  const rows = await tx.$queryRaw<Array<{ total: bigint | null }>>`
    SELECT SUM(amount_minor)::bigint AS total FROM order_cost_lines
     WHERE order_id = ${orderId}::uuid AND type = ${type}::order_cost_type
       AND source_type = ${sourceType} AND (source_id = ${sourceIdPrefix}
            OR source_id LIKE ${sourceIdPrefix + ':%'})`;
  return rows[0]?.total ?? 0n;
}

export async function orderForProfit(tx: Tx, orderId: string) {
  return tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      currency: true,
      discountMinor: true,
      shippingChargedMinor: true,
      refundedMinor: true,
      deliveredAt: true,
      items: {
        select: {
          id: true,
          variantId: true,
          quantity: true,
          unitPriceMinor: true,
          unitCostMinor: true,
          discountMinor: true,
        },
      },
    },
  });
}

/** Units that came back resellable, per order line. */
export async function restockedUnitsByItem(tx: Tx, orderId: string): Promise<Map<string, number>> {
  const rows = await tx.returnItem.groupBy({
    by: ['orderItemId'],
    where: { condition: 'resellable', returnRequest: { orderId, status: { not: 'rejected' } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
}

export const orderCurrency = (tx: Tx, orderId: string) =>
  tx.order.findUnique({ where: { id: orderId }, select: { currency: true } });
