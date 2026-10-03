import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createDbClient, db } from '@/lib/db';
import { purgeFinishedEvents } from '@/lib/outbox';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(closeDatabase);

/** Runs `fn` as the application role (a real login when available, otherwise SET ROLE). */
async function asApp<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const appUrl = inject('appDatabaseUrl');
  if (appUrl) {
    const client = createDbClient(appUrl);
    try {
      return await fn(client);
    } finally {
      await client.$disconnect();
    }
  }
  if (process.env.DB_POOL_MAX !== '1') throw new Error('Run with DB_POOL_MAX=1 or a real login.');
  await db.$executeRawUnsafe('SET ROLE auren_app');
  try {
    return await fn(db);
  } finally {
    await db.$executeRawUnsafe('RESET ROLE');
  }
}

/**
 * The in-process PostgreSQL used when Docker is unavailable drops the connection after some
 * errors raised by plpgsql; a real server (Testcontainers) reports the exact message.
 */
const refused = (message: RegExp): RegExp =>
  inject('appDatabaseUrl') ? message : new RegExp(`${message.source}|closed the connection`);

const insertEvent = (id: string, status: string, ageDays: number) =>
  db.$executeRawUnsafe(
    `INSERT INTO outbox_events (id, type, aggregate_type, aggregate_id, payload, status, created_at, dispatched_at)
     VALUES ('${id}'::uuid, 'system.sample', 'sample', '${id}', '{"message":"x"}'::jsonb, '${status}'::outbox_status,
             now() - interval '${ageDays} days',
             ${status === 'dispatched' ? `now() - interval '${ageDays} days'` : 'NULL'})`,
  );

const insertClaim = (eventId: string, ageDays: number) =>
  db.$executeRawUnsafe(
    `INSERT INTO processed_events (consumer, event_id, processed_at)
     VALUES ('retention-test', '${eventId}', now() - interval '${ageDays} days')`,
  );

describe('retention of finished events', () => {
  const OLD_DISPATCHED = '00000000-0000-7000-8000-000000000001';
  const NEW_DISPATCHED = '00000000-0000-7000-8000-000000000002';
  const OLD_PENDING = '00000000-0000-7000-8000-000000000003';
  const OLD_FAILED = '00000000-0000-7000-8000-000000000004';

  async function seed() {
    await insertEvent(OLD_DISPATCHED, 'dispatched', 45);
    await insertEvent(NEW_DISPATCHED, 'dispatched', 2);
    await insertEvent(OLD_PENDING, 'pending', 45);
    await insertEvent(OLD_FAILED, 'failed', 45);
    await insertClaim('old', 45);
    await insertClaim('new', 1);
  }

  it('deletes only old dispatched events and old claims, as the application role', async () => {
    await seed();
    const summary = await asApp((client) => purgeFinishedEvents(client, 30));
    expect(summary).toEqual({ outboxDeleted: 1, inboxDeleted: 1 });

    const left = await db.outboxEvent.findMany({ orderBy: { id: 'asc' }, select: { id: true } });
    expect(left.map((row) => row.id)).toEqual([NEW_DISPATCHED, OLD_PENDING, OLD_FAILED]);
    const claims = await db.processedEvent.findMany({ select: { eventId: true } });
    expect(claims.map((row) => row.eventId)).toEqual(['new']);
  });

  it('never keeps less than seven days, whatever the caller asks', async () => {
    await seed();
    // (checked as the owner: the rule lives inside the function, whoever calls it)
    await expect(purgeFinishedEvents(db, 1)).rejects.toThrow(refused(/at least 7 days/));
    await expect(purgeFinishedEvents(db, 0)).rejects.toThrow(refused(/at least 7 days/));
    expect(await db.outboxEvent.count()).toBe(4);
  });

  it('is idempotent', async () => {
    await seed();
    await asApp((client) => purgeFinishedEvents(client, 30));
    expect(await asApp((client) => purgeFinishedEvents(client, 30))).toEqual({
      outboxDeleted: 0,
      inboxDeleted: 0,
    });
  });

  it('does not open a general delete path: direct deletes stay refused', async () => {
    await seed();
    // The application role has no DELETE privilege at all.
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE auren_app');
        await tx.$executeRawUnsafe('DELETE FROM outbox_events');
      }),
    ).rejects.toThrow(/permission denied/i);
    // Even the owner is stopped by the trigger outside the purge function.
    await expect(db.$executeRawUnsafe('DELETE FROM outbox_events')).rejects.toThrow(
      refused(/cannot be deleted/),
    );
    // ... and pending or failed rows are not deletable even inside the window where purge is on.
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('auren.event_purge', 'on', true)`);
        await tx.$executeRawUnsafe(`DELETE FROM outbox_events WHERE status = 'pending'`);
      }),
    ).rejects.toThrow(refused(/cannot be deleted/));
    expect(await db.outboxEvent.count()).toBe(4);
  });
});
