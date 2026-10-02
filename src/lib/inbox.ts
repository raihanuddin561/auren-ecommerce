import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Tx } from './db';

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
