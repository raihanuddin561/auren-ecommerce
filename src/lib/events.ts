import { z } from 'zod';

/**
 * Registry of domain events that can be written to the outbox. Each entry is the contract between
 * the module that publishes the event and the handlers that consume it (ARCHITECTURE section 3.2).
 * Payloads are plain JSON: ids and text, never bigint, Date or Money objects.
 */
export const eventSchemas = {
  /** Used by the foundation to prove delivery, retries and idempotency end to end. */
  'system.sample': z.object({ message: z.string().min(1).max(200) }),
} as const;

export type EventType = keyof typeof eventSchemas;
export type EventPayload<T extends EventType> = z.infer<(typeof eventSchemas)[T]>;

export const isEventType = (value: string): value is EventType => value in eventSchemas;
