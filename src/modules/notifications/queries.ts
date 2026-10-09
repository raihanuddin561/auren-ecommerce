import { z } from 'zod';
import { eventSchemas } from '@/lib/events';
import { inngest } from '@/lib/jobs/client';
import { logger } from '@/lib/logger';
import {
  notifyEscalation,
  notifyOrderReceivedSms,
  notifyOrderStatus,
  notifyOrderUpdated,
  notifyRefund,
  notifyReturn,
} from './dispatch';

/**
 * Background handlers for order messages (13.2, 13.3). Each validates its event, sends outside any
 * transaction, claims the send in `processed_events` (idempotent) and logs it. Registered in
 * src/app/api/inngest/route.ts.
 */

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ outboxId: z.uuid(), payload: schema });

const run = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    logger.error({ err: error }, `${name} handler failed`);
    throw error;
  }
};

export async function handleOrderStatusChanged(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['order.status_changed']).parse(data);
  return notifyOrderStatus(outboxId, payload.orderId, payload.to);
}

export async function handleOrderUpdated(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['order.updated']).parse(data);
  return notifyOrderUpdated(outboxId, payload.orderId, payload.totalChanged);
}

export async function handleRefundProcessed(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['refund.processed']).parse(data);
  return notifyRefund(outboxId, payload.refundId);
}

export async function handleReturnStatusChanged(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['return.status_changed']).parse(data);
  return notifyReturn(outboxId, payload.returnId, payload.status);
}

export async function handleOrderPlacedSms(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['order.placed']).parse(data);
  return notifyOrderReceivedSms(outboxId, payload.orderId);
}

export async function handleOrderEscalated(data: unknown) {
  const { outboxId, payload } = envelope(eventSchemas['order.escalated']).parse(data);
  return notifyEscalation(outboxId, payload.orderId, payload.reason);
}

const statusMessages = inngest.createFunction(
  { id: 'order-status-messages', triggers: [{ event: 'order.status_changed' }], retries: 4 },
  async ({ event }) => run('order.status_changed', () => handleOrderStatusChanged(event.data)),
);
const updatedMessages = inngest.createFunction(
  { id: 'order-updated-messages', triggers: [{ event: 'order.updated' }], retries: 4 },
  async ({ event }) => run('order.updated', () => handleOrderUpdated(event.data)),
);
const refundMessages = inngest.createFunction(
  { id: 'refund-messages', triggers: [{ event: 'refund.processed' }], retries: 4 },
  async ({ event }) => run('refund.processed', () => handleRefundProcessed(event.data)),
);
const returnMessages = inngest.createFunction(
  { id: 'return-messages', triggers: [{ event: 'return.status_changed' }], retries: 4 },
  async ({ event }) => run('return.status_changed', () => handleReturnStatusChanged(event.data)),
);
const receivedSms = inngest.createFunction(
  { id: 'order-received-sms', triggers: [{ event: 'order.placed' }], retries: 4 },
  async ({ event }) => run('order.placed sms', () => handleOrderPlacedSms(event.data)),
);
const escalationMail = inngest.createFunction(
  { id: 'order-escalation-mail', triggers: [{ event: 'order.escalated' }], retries: 4 },
  async ({ event }) => run('order.escalated', () => handleOrderEscalated(event.data)),
);

export const notificationFunctions = [
  statusMessages,
  updatedMessages,
  refundMessages,
  returnMessages,
  receivedSms,
  escalationMail,
];
