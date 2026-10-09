import type { Prisma } from '@/generated/prisma/client';
import { toCsv } from '@/lib/csv';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { money, toDecimalString } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import { deleteView, getSavedViews, saveView, type SavedView } from '@/modules/settings/service';
import type { AdminOrderListParams } from './admin-types';
import { shipOrder, startProcessing, type Fulfiller } from './fulfilment';
import * as repo from './repository';

/**
 * The orders list and what staff do from it: filters, CSV export, bulk actions on confirmed orders,
 * and saved views. Exports are audited, capped and guarded against spreadsheet formulas; bulk
 * actions touch confirmed orders only (the state machine refuses the rest).
 */

/** The start of a Dhaka calendar day (UTC+6) as an instant. */
const dayStart = (day: string) => new Date(`${day}T00:00:00+06:00`);
const isDay = (value: string | undefined): value is string =>
  value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function listWhere(params: AdminOrderListParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (params.status === 'awaiting_verification') {
    where.status = { in: ['placed', 'under_verification', 'on_hold'] };
  } else if (params.status === 'ready_to_ship') {
    where.status = { in: ['confirmed', 'processing'] };
  } else if (params.status) {
    where.status = params.status;
  }
  if (params.payment) where.paymentStatus = params.payment;
  if (params.channel) where.channel = params.channel;
  if (params.assignee === 'unassigned') where.assignedTo = null;
  else if (params.assignee && isUuid(params.assignee)) where.assignedTo = params.assignee;
  const placed: Prisma.DateTimeFilter = {};
  if (isDay(params.from)) placed.gte = dayStart(params.from);
  if (isDay(params.to)) placed.lt = new Date(dayStart(params.to).getTime() + 24 * 3600 * 1000);
  if (placed.gte || placed.lt) where.placedAt = placed;
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

export const EXPORT_LIMIT = 5000;

export interface ExportActor {
  userId: string;
  staffId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * The orders that match the filters as CSV text, audited with who, the filter and the row count.
 * The caller has already checked the permission and the fresh step-up.
 */
export async function exportOrdersCsv(
  filter: Omit<AdminOrderListParams, 'page'>,
  actor: ExportActor,
): Promise<{ csv: string; rows: number; filename: string }> {
  const assignee = filter.assignee === 'mine' ? actor.staffId : filter.assignee;
  const rows = await repo.listOrders(db, {
    where: listWhere({ ...filter, ...(assignee ? { assignee } : {}), page: 1 }),
    skip: 0,
    take: EXPORT_LIMIT,
  });
  const csv = toCsv(
    [
      'Order',
      'Placed',
      'Status',
      'Payment',
      'Channel',
      'Customer',
      'Phone',
      'Email',
      'Items',
      'Total',
    ],
    rows.map((row) => [
      row.orderNumber,
      row.placedAt.toISOString(),
      row.status,
      row.paymentStatus,
      row.channel,
      row.customerName,
      row.phone,
      row.email ?? '',
      row._count.items,
      toDecimalString(money(row.totalMinor, row.currency)),
    ]),
  );
  await db.$transaction((tx) =>
    audit(tx, {
      actorId: actor.userId,
      action: 'export.orders',
      entity: 'orders',
      entityId: actor.staffId,
      after: { filter, rows: rows.length },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    }),
  );
  return {
    csv,
    rows: rows.length,
    filename: `orders-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export interface BulkResult {
  done: number;
  failed: Array<{ id: string; reason: string }>;
}

const reasonOf = (error: unknown) => (error instanceof DomainError ? error.message : 'Failed');

/** Start picking for several orders. An order that is not confirmed is reported and left alone. */
export async function bulkStartPicking(
  orderIds: readonly string[],
  fulfiller: Fulfiller,
): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] };
  for (const orderId of new Set(orderIds)) {
    try {
      await db.$transaction((tx) => startProcessing(tx, { orderId, fulfiller }));
      result.done += 1;
    } catch (error) {
      result.failed.push({ id: orderId, reason: reasonOf(error) });
    }
  }
  return result;
}

/** Book several orders with a courier that has an API. Each booking is its own transaction. */
export async function bulkBookCourier(
  orderIds: readonly string[],
  courier: 'pathao' | 'steadfast',
  fulfiller: Fulfiller,
): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] };
  for (const orderId of new Set(orderIds)) {
    try {
      await shipOrder({ orderId, courier, fulfiller });
      result.done += 1;
    } catch (error) {
      result.failed.push({ id: orderId, reason: reasonOf(error) });
    }
  }
  return result;
}

// Saved views -------------------------------------------------------------------------------

const ORDERS_LIST = 'orders';
const VIEW_KEYS = ['status', 'q', 'payment', 'channel', 'assignee', 'from', 'to'] as const;

export const savedOrderViews = (userId: string) => getSavedViews(ORDERS_LIST, userId);

/** Keeps only the filter keys the list understands, whatever was sent. */
export function saveOrderView(userId: string, name: string, query: string): Promise<SavedView[]> {
  const incoming = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of VIEW_KEYS) {
    const value = incoming.get(key);
    if (value) kept.set(key, value);
  }
  return saveView(ORDERS_LIST, userId, { name, query: kept.toString() });
}

export const deleteOrderView = (userId: string, name: string) =>
  deleteView(ORDERS_LIST, userId, name);
