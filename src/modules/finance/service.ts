import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { money, serialize } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as inventory from '@/modules/inventory/service';
import { computeOrderProfit, type OrderProfit } from './profit';
import * as repo from './repository';
import type { CostType, OrderProfitView } from './types';

export type { CostType, OrderProfit, OrderProfitView };

// ---------------------------------------------------------------------------------------------
// Order cost lines (11.5)
// ---------------------------------------------------------------------------------------------

export interface RecordCostInput {
  orderId: string;
  type: CostType;
  amountMinor: bigint;
  currency: string;
  /** Where the cost came from, for example `shipment`. A cost with a source is recorded once. */
  sourceType?: string;
  sourceId?: string;
  note?: string | null;
  /** staff_members.id or null for an automatic line. */
  actorId?: string | null;
}

/**
 * Records one cost against an order, in the caller's transaction. Automatic costs (courier,
 * packaging, COD fee, gateway fee, return shipping, RTO loss) pass the record they come from, so the
 * same cost is never counted twice when a job or a handler runs again (INV-F2, INV-E2).
 */
export async function recordCostLine(tx: Tx, input: RecordCostInput): Promise<boolean> {
  if (input.amountMinor === 0n) return false;
  if (input.sourceId && !input.sourceType) {
    throw new DomainError('INTERNAL', 'A cost with a source id needs a source type.');
  }
  return repo.insertCostLine(tx, {
    orderId: input.orderId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    note: input.note ?? null,
    actorId: input.actorId ?? null,
  });
}

/**
 * Brings the booked amount of one source up (or down) to `targetMinor` with a delta line, so a
 * corrected courier charge changes the order cost without rewriting history.
 */
export async function setSourceCost(
  tx: Tx,
  input: {
    orderId: string;
    type: CostType;
    currency: string;
    sourceType: string;
    sourceId: string;
    targetMinor: bigint;
    actorId?: string | null;
    note?: string;
  },
): Promise<bigint> {
  const booked = await repo.sumCostBySource(
    tx,
    input.orderId,
    input.type,
    input.sourceType,
    input.sourceId,
  );
  const delta = input.targetMinor - booked;
  if (delta === 0n) return 0n;
  const first = booked === 0n;
  await repo.insertCostLine(tx, {
    orderId: input.orderId,
    type: input.type,
    amountMinor: delta,
    currency: input.currency,
    sourceType: input.sourceType,
    sourceId: first ? input.sourceId : `${input.sourceId}:adj:${crypto.randomUUID()}`,
    note: input.note ?? (first ? null : 'Correction'),
    actorId: input.actorId ?? null,
  });
  return delta;
}

/** Gateway fee captured when an online payment succeeds (5.4). Cash on delivery has none. */
export async function recordGatewayFee(
  tx: Tx,
  input: { orderId: string; paymentId: string; feeMinor: bigint; currency: string },
): Promise<boolean> {
  return recordCostLine(tx, {
    orderId: input.orderId,
    type: 'gateway_fee',
    amountMinor: input.feeMinor,
    currency: input.currency,
    sourceType: 'payment',
    sourceId: input.paymentId,
  });
}

export interface AddManualCostInput {
  orderId: string;
  amountMinor: bigint;
  note: string;
  actorUserId: string;
  actorStaffId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Staff adds a cost nobody records automatically (a gift wrap, a tip to the rider). Audited. */
export async function addManualCostLine(input: AddManualCostInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await repo.orderCurrency(tx, input.orderId);
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
    await recordCostLine(tx, {
      orderId: input.orderId,
      type: 'other',
      amountMinor: input.amountMinor,
      currency: order.currency,
      note: input.note,
      actorId: input.actorStaffId,
    });
    await audit(tx, {
      actorId: input.actorUserId,
      action: 'order.cost_add',
      entity: 'order',
      entityId: input.orderId,
      after: { amountMinor: input.amountMinor.toString(), note: input.note },
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Order profit breakdown (11.6)
// ---------------------------------------------------------------------------------------------

/** Orders where no sale happened (cancelled, sent back to origin): only costs and unrecovered goods count. */
const NO_SALE = new Set(['cancelled', 'returned_to_origin', 'payment_expired']);

/** Statuses in which revenue counts (delivered date, ARCHITECTURE section 7.2). */
const RECOGNISED = new Set([
  'delivered',
  'completed',
  'return_requested',
  'returned',
  'refunded',
  'exchanged',
]);

/**
 * The profit of one order, derived from its line snapshots, its cost lines and its refunds.
 * Callers show it only to staff who may see cost (`canSeeCostOfGoods`); this function does not
 * decide who may look.
 */
export async function getOrderProfit(
  orderId: string,
  tx: Tx = db,
): Promise<OrderProfitView | null> {
  const order = await repo.orderForProfit(tx, orderId);
  if (!order) return null;
  const [costLines, restocked] = await Promise.all([
    repo.listCostLines(tx, orderId),
    repo.restockedUnitsByItem(tx, orderId),
  ]);
  const recognised = RECOGNISED.has(order.status);
  const noSale = NO_SALE.has(order.status);
  // No sale: the goods that did not come back are the loss, read from the stock ledger.
  const stillOut = noSale ? await inventory.netSoldStock(tx, 'order', orderId) : null;
  const profit = computeOrderProfit({
    lines: order.items.map((item) => ({
      quantity: item.quantity,
      unitPriceMinor: noSale ? 0n : item.unitPriceMinor,
      unitCostMinor: item.unitCostMinor,
      discountMinor: noSale ? 0n : item.discountMinor,
      restockedUnits: noSale
        ? Math.max(0, item.quantity - (stillOut?.get(item.variantId) ?? 0))
        : Math.min(item.quantity, restocked.get(item.id) ?? 0),
    })),
    orderDiscountMinor: noSale ? 0n : order.discountMinor,
    shippingChargedMinor: noSale ? 0n : order.shippingChargedMinor,
    refundedMinor: noSale ? 0n : order.refundedMinor,
    costLines: costLines.map((line) => ({ type: line.type, amountMinor: line.amountMinor })),
    recognised,
  });
  const at = (minor: bigint) => serialize(money(minor, order.currency));
  return {
    recognised,
    currency: order.currency,
    figures: {
      grossSales: at(profit.grossSalesMinor),
      discounts: at(profit.discountsMinor),
      refunds: at(profit.refundsMinor),
      netSales: at(profit.netSalesMinor),
      cogs: at(profit.cogsMinor),
      grossProfit: at(profit.grossProfitMinor),
      shippingCharged: at(profit.shippingChargedMinor),
      shippingCost: at(profit.shippingCostMinor),
      gatewayFees: at(profit.gatewayFeesMinor),
      codFees: at(profit.codFeesMinor),
      packaging: at(profit.packagingMinor),
      returnCosts: at(profit.returnCostsMinor),
      otherCosts: at(profit.otherCostsMinor),
      contributionMargin: at(profit.contributionMarginMinor),
    },
    marginBps: profit.marginBps === null ? null : profit.marginBps.toString(),
    costLines: costLines.map((line) => ({
      type: line.type,
      amount: at(line.amountMinor),
      note: line.note,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}
