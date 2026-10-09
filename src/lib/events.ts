import { z } from 'zod';

/**
 * Registry of domain events that can be written to the outbox. Each entry is the contract between
 * the module that publishes the event and the handlers that consume it (ARCHITECTURE section 3.2).
 * Payloads are plain JSON: ids and text, never bigint, Date or Money objects.
 */
export const eventSchemas = {
  /** Used by the foundation to prove delivery, retries and idempotency end to end. */
  'system.sample': z.object({ message: z.string().min(1).max(200) }),
  /** A high-value action is waiting for a second person (ids only, INV-A9). */
  'approval.requested': z.object({
    approvalId: z.uuid(),
    kind: z.string().min(1).max(40),
    subjectType: z.string().min(1).max(40),
    subjectId: z.string().min(1).max(64),
  }),
  'approval.decided': z.object({
    approvalId: z.uuid(),
    kind: z.string().min(1).max(40),
    decision: z.enum(['approved', 'rejected']),
  }),
  /** Goods arrived against a purchase order (ids only, INV-A9); `complete` when nothing is outstanding. */
  'purchase_order.received': z.object({
    purchaseOrderId: z.uuid(),
    receiptId: z.uuid(),
    complete: z.boolean(),
  }),
  /** A customer placed an order (ids and amounts only, INV-A9). It still needs staff verification. */
  'order.placed': z.object({
    orderId: z.uuid(),
    paymentMethod: z.enum(['cod', 'sslcommerz', 'stripe', 'bkash']),
    currency: z.string().length(3),
    totalMinor: z.string().regex(/^\d+$/),
    channel: z.enum(['web', 'manual', 'facebook', 'instagram', 'whatsapp', 'store']),
  }),
  /**
   * Every move of an order through its lifecycle (ids and statuses only, INV-A9). Handlers (emails,
   * SMS, analytics, finance rollups) key on `to`.
   */
  'order.status_changed': z.object({
    orderId: z.uuid(),
    from: z.string().min(1).max(40),
    to: z.string().min(1).max(40),
    /** The staff member (staff_members.id) who made the move; absent for an automatic move. */
    actorId: z.uuid().optional(),
  }),
  /** Staff changed the lines, address or delivery of an order while verifying it. */
  'order.updated': z.object({
    orderId: z.uuid(),
    totalChanged: z.boolean(),
  }),
  /** An order waits too long or could not be reached: managers should look (it is never cancelled). */
  'order.escalated': z.object({
    orderId: z.uuid(),
    reason: z.enum(['sla_overdue', 'failed_attempts']),
  }),
  /** A refund was recorded (full or partial). */
  'refund.processed': z.object({
    refundId: z.uuid(),
    orderId: z.uuid(),
  }),
  /** A return request moved (requested, approved, rejected, received, inspected, resolved). */
  'return.status_changed': z.object({
    returnId: z.uuid(),
    orderId: z.uuid(),
    status: z.string().min(1).max(40),
  }),
  /** A parcel changed state (booked, picked up, delivered ...). */
  'shipment.updated': z.object({
    shipmentId: z.uuid(),
    orderId: z.uuid(),
    status: z.string().min(1).max(40),
  }),
  /** Staff verified and confirmed the order (ids only, INV-A9). */
  'order.confirmed': z.object({
    orderId: z.uuid(),
    confirmedBy: z.uuid(),
  }),
  /** Staff cancelled the order (ids and reason only, INV-A9). */
  'order.cancelled': z.object({
    orderId: z.uuid(),
    cancelledBy: z.uuid(),
    reason: z.string().min(1).max(40),
  }),
  /** An audit rule fired (ids and counts only): who acted and which audit row to look at. */
  'security.alert': z.object({
    rule: z.string().min(1).max(60),
    auditLogId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    count: z.number().int().nonnegative().optional(),
    windowMinutes: z.number().int().positive().optional(),
  }),
} as const;

export type EventType = keyof typeof eventSchemas;
export type EventPayload<T extends EventType> = z.infer<(typeof eventSchemas)[T]>;

export const isEventType = (value: string): value is EventType => value in eventSchemas;
