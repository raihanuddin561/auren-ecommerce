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
