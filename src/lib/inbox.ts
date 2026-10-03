import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Tx } from './db';

/** Whether (consumer, eventId) was already handled. For effects that must happen outside a transaction. */
export async function wasProcessed(
  client: PrismaClient,
  consumer: string,
  eventId: string,
): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ one: number }>>`
    SELECT 1 AS one FROM processed_events WHERE consumer = ${consumer} AND event_id = ${eventId}`;
  return rows.length > 0;
}

/** Records that (consumer, eventId) was handled (no-op if it already was). */
export async function markProcessed(
  client: PrismaClient,
  consumer: string,
  eventId: string,
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO processed_events (consumer, event_id, processed_at)
    VALUES (${consumer}, ${eventId}, now())
    ON CONFLICT (consumer, event_id) DO NOTHING`;
}

export type OnceResult<T> = { executed: true; value: T } | { executed: false };

/**
 * Runs `work` at most once per (consumer, eventId), inside one transaction with the claim.
 * Re-delivery of the same event is a no-op (INV-E2); if `work` throws, the claim rolls back so the
 * retry runs it again. Keep `work` to database effects; for email, SMS or HTTP use the provider's
 * own idempotency key (the outbox id is a good one).
 */
export async function runOnce<T>(
  client: PrismaClient,
  consumer: string,
  eventId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<OnceResult<T>> {
  return client.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`
      INSERT INTO processed_events (consumer, event_id, processed_at)
      VALUES (${consumer}, ${eventId}, now())
      ON CONFLICT (consumer, event_id) DO NOTHING`;
    if (claimed === 0) return { executed: false } as const;
    return { executed: true, value: await work(tx) } as const;
  });
}
