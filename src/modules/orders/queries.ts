import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { inngest } from '@/lib/jobs/client';
import { wasProcessed, markProcessed } from '@/lib/inbox';
import { eventSchemas } from '@/lib/events';
import { money, serialize, type SerializedMoney } from '@/lib/money';
import * as repo from './repository';
import * as orders from './service';
import { STATUS_LABEL, isAwaitingVerification, type OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

export { viewForToken, lookupMinimal, customerViewById } from './service';

// ---------------------------------------------------------------------------------------------
// Admin: the orders list and one order (read only; verification arrives with the queue)
// ---------------------------------------------------------------------------------------------

export const ORDERS_PAGE_SIZE = 25;

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  statusLabel: string;
  awaitingVerification: boolean;
  paymentStatus: string;
  total: SerializedMoney;
  placedAt: string;
  itemCount: number;
  riskFlags: string[];
}

export interface AdminOrderListParams {
  status?: OrderStatus | 'awaiting_verification';
  q?: string;
  page: number;
}

function listWhere(params: AdminOrderListParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (params.status === 'awaiting_verification') {
    where.status = { in: ['placed', 'under_verification', 'on_hold'] };
  } else if (params.status) {
    where.status = params.status;
  }
  const q = params.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, '');
    where.OR = [
      { orderNumber: { contains: q.toUpperCase() } },
      { customerName: { contains: q, mode: 'insensitive' } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ...(q.includes('@') ? [{ email: { equals: q, mode: 'insensitive' as const } }] : []),
    ];
  }
  return where;
}

export async function listOrdersForAdmin(params: AdminOrderListParams) {
  const where = listWhere(params);
  const [rows, total, counts] = await Promise.all([
    repo.listOrders(db, {
      where,
      skip: (Math.max(1, params.page) - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
    }),
    repo.countOrders(db, where),
    repo.statusCounts(db),
  ]);
  const byStatus = new Map(counts.map((row) => [row.status as OrderStatus, row._count._all]));
  const awaiting = (['placed', 'under_verification', 'on_hold'] as const).reduce(
    (sum, status) => sum + (byStatus.get(status) ?? 0),
    0,
  );
  return {
    rows: rows.map((row): AdminOrderRow => ({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      phone: row.phone,
      status: row.status as OrderStatus,
      statusLabel: STATUS_LABEL[row.status as OrderStatus],
      awaitingVerification: isAwaitingVerification(row.status as OrderStatus),
      paymentStatus: row.paymentStatus,
      total: serialize(money(row.totalMinor, row.currency)),
      placedAt: row.placedAt.toISOString(),
      itemCount: row._count.items,
      riskFlags: row.riskFlags,
    })),
    total,
    pageSize: ORDERS_PAGE_SIZE,
    awaitingCount: awaiting,
  };
}

export interface AdminOrderItem {
  title: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPrice: SerializedMoney;
  /** Cost of goods at the time of sale; present only for staff who may see costs. */
  unitCost: SerializedMoney | null;
  lineTotal: SerializedMoney;
  imageUrl: string | null;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  awaitingVerification: boolean;
  placedAt: string;
  customer: { name: string; phone: string; email: string | null };
  address: ShippingAddressSnapshot;
  delivery: ShippingMethodSnapshot;
  customerNote: string | null;
  items: AdminOrderItem[];
  subtotal: SerializedMoney;
  discount: SerializedMoney;
  shipping: SerializedMoney;
  total: SerializedMoney;
  /** Revenue minus cost of goods; null when costs are hidden from this staff member. */
  grossProfit: SerializedMoney | null;
  payments: Array<{
    provider: string;
    method: string;
    status: string;
    amount: SerializedMoney;
    createdAt: string;
  }>;
  events: Array<{
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
  }>;
  paymentStatus: string;
  riskScore: number;
  riskFlags: string[];
  confirmedAt: string | null;
}

export async function getOrderForAdmin(
  id: string,
  options: { includeCost: boolean },
): Promise<AdminOrderDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const order = await repo.findById(db, id);
  if (!order) return null;
  const events = await repo.findEvents(db, id);
  const status = order.status as OrderStatus;
  const cogs = order.items.reduce(
    (sum, item) => sum + item.unitCostMinor * BigInt(item.quantity),
    0n,
  );
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    statusLabel: STATUS_LABEL[status],
    awaitingVerification: isAwaitingVerification(status),
    placedAt: order.placedAt.toISOString(),
    customer: { name: order.customerName, phone: order.phone, email: order.email },
    address: order.shippingAddress as unknown as ShippingAddressSnapshot,
    delivery: order.shippingMethod as unknown as ShippingMethodSnapshot,
    customerNote: order.customerNote,
    items: order.items.map((item) => ({
      title: item.titleSnapshot,
      variantLabel: item.variantTitleSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: serialize(money(item.unitPriceMinor, order.currency)),
      unitCost: options.includeCost ? serialize(money(item.unitCostMinor, order.currency)) : null,
      lineTotal: serialize(money(item.totalMinor, order.currency)),
      imageUrl: item.imageSnapshot,
    })),
    subtotal: serialize(money(order.subtotalMinor, order.currency)),
    discount: serialize(money(order.discountMinor, order.currency)),
    shipping: serialize(money(order.shippingChargedMinor, order.currency)),
    total: serialize(money(order.totalMinor, order.currency)),
    grossProfit: options.includeCost
      ? serialize(money(order.subtotalMinor - order.discountMinor - cogs, order.currency))
      : null,
    payments: order.payments.map((payment) => ({
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      amount: serialize(money(payment.amountMinor, payment.currency)),
      createdAt: payment.createdAt.toISOString(),
    })),
    events: events.map((event) => ({
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
    })),
    paymentStatus: order.paymentStatus,
    riskScore: order.riskScore,
    riskFlags: order.riskFlags,
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------------------------

const placedEnvelope = z.object({
  outboxId: z.uuid(),
  payload: eventSchemas['order.placed'],
});

const EMAIL_CONSUMER = 'order.placed.received-email';

/** Handles one `order.placed` event: sends the "we have your order" email exactly once. */
export async function handleOrderPlaced(data: unknown): Promise<{ result: 'sent' | 'skipped' }> {
  const { outboxId, payload } = placedEnvelope.parse(data);
  if (await wasProcessed(db, EMAIL_CONSUMER, outboxId)) return { result: 'skipped' };
  const result = await orders.sendOrderReceivedEmail(payload.orderId);
  await markProcessed(db, EMAIL_CONSUMER, outboxId);
  return { result };
}

export const orderReceivedEmail = inngest.createFunction(
  { id: 'order-received-email', triggers: [{ event: 'order.placed' }], retries: 4 },
  async ({ event }) => {
    try {
      return await handleOrderPlaced(event.data);
    } catch (error) {
      logger.error({ err: error }, 'order.placed handler failed');
      throw error;
    }
  },
);

export const orderFunctions = [orderReceivedEmail];
