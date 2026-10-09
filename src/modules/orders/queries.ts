import { z } from 'zod';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { inngest } from '@/lib/jobs/client';
import { wasProcessed, markProcessed } from '@/lib/inbox';
import { eventSchemas } from '@/lib/events';
import { money, serialize } from '@/lib/money';
import { escalateOverdueOrders } from './escalation';
import { completeOrdersPastReturnWindow, pollParcels } from './fulfilment';
import { listWhere } from './list';
import * as repo from './repository';
import * as orders from './service';
import { STATUS_LABEL, isAwaitingVerification, type OrderStatus } from './timeline';

export { viewForToken, lookupMinimal, customerViewById } from './service';
export * from './admin-types';
export { savedOrderViews } from './list';
import type { AdminOrderListParams, AdminOrderRow } from './admin-types';
export {
  getVerificationQueue,
  getVerificationWorkspace,
  listVerifierStaff,
  searchSellableVariants,
} from './workspace';
export { approvalLabels, getFulfilmentBoard } from './detail';
export { MAX_BATCH, loadOrderDocuments } from './documents-data';

// ---------------------------------------------------------------------------------------------
// Admin: the orders list and one order (read only; verification arrives with the queue)
// ---------------------------------------------------------------------------------------------

export const ORDERS_PAGE_SIZE = 25;

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
      channel: row.channel,
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

export { getOrderForAdmin } from './detail';

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

/** Cron: tells managers about orders that waited past the verification target. Flags only; never cancels. */
const escalationScan = inngest.createFunction(
  { id: 'order-escalation-scan', triggers: [{ cron: '*/10 * * * *' }], concurrency: { limit: 1 } },
  async () => escalateOverdueOrders(),
);

/** Cron: asks the courier APIs where parcels are. The manual courier is updated by staff. */
const courierPoll = inngest.createFunction(
  { id: 'courier-poll', triggers: [{ cron: '*/15 * * * *' }], concurrency: { limit: 1 } },
  async () => pollParcels(),
);

/** Cron: delivered orders past the return window become completed (it moves no money or stock). */
const orderCompletion = inngest.createFunction(
  { id: 'order-completion', triggers: [{ cron: '23 2 * * *' }], concurrency: { limit: 1 } },
  async () => completeOrdersPastReturnWindow(),
);

export const orderFunctions = [orderReceivedEmail, escalationScan, courierPoll, orderCompletion];
