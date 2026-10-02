import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Tx } from './db';
import { eventSchemas, type EventPayload, type EventType } from './events';
import { logger } from './logger';

export interface EnqueueInput<T extends EventType> {
  type: T;
  /** The entity the event is about, for example `order`. */
  aggregateType: string;
  aggregateId: string;
  payload: EventPayload<T>;
}

/**
 * Writes a domain event inside the caller's transaction, so it exists if and only if the state
 * change it describes was committed. Never send the email, SMS or webhook here (INV-E1): a
 * dispatcher forwards the row to Inngest after commit.
 */
export async function enqueueEvent<T extends EventType>(
  tx: Tx,
  input: EnqueueInput<T>,
): Promise<string> {
  const payload = eventSchemas[input.type].parse(input.payload);
  const row = await tx.outboxEvent.create({
    data: {
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload,
    },
    select: { id: true },
  });
  return row.id;
}

// ---------------------------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------------------------

export const MAX_DISPATCH_ATTEMPTS = 12;
const LEASE_SECONDS = 60;
const BASE_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 15 * 60;

/** Exponential backoff after the nth failed attempt: 5s, 10s, 20s ... capped at 15 minutes. */
export function retryDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_SECONDS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_SECONDS) * 1000;
}

export interface LeasedEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}

export type SendEvents = (events: LeasedEvent[]) => Promise<void>;

export interface DispatchSummary {
  leased: number;
  dispatched: number;
  /** Events that exhausted their attempts in this run and are now terminal. */
  failed: number;
}

interface LeasedRow {
  id: string;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  attempts: number;
  created_at: Date;
}

/**
 * Sends pending outbox events to the job runner.
 *
 *  0. Rows that already used all their attempts (for example a worker that kept crashing between
 *     send and mark) are moved to `failed` so they stop cycling.
 *  1. A short transaction leases a batch (`FOR UPDATE SKIP LOCKED`), so parallel dispatchers never
 *     take the same rows, counts the attempt and pushes `available_at` out by the backoff.
 *  2. The network call happens outside any transaction. If the batch is rejected, events are sent
 *     one by one so a single bad event cannot burn attempts for its neighbours.
 *  3. Rows are marked dispatched, or rescheduled with backoff. After MAX attempts a row becomes
 *     `failed` and stays visible for operators; it is never deleted.
 *
 * A crash between 2 and 3 only lets the lease expire; the event is sent again with the same id,
 * which the job runner de-duplicates for about a day, and consumers are idempotent anyway (INV-E2).
 */
export async function dispatchPendingEvents(
  client: PrismaClient,
  send: SendEvents,
  options: { limit?: number } = {},
): Promise<DispatchSummary> {
  const limit = options.limit ?? 50;

  await client.$executeRaw`
    UPDATE outbox_events
       SET status = 'failed',
           last_error = COALESCE(last_error, 'Gave up: delivery attempts exhausted'),
           locked_until = NULL
     WHERE status = 'pending'
       AND attempts >= ${MAX_DISPATCH_ATTEMPTS}
       AND (locked_until IS NULL OR locked_until < now())`;

  const rows = await client.$queryRaw<LeasedRow[]>`
    WITH picked AS MATERIALIZED (
      SELECT id FROM outbox_events
       WHERE status = 'pending'
         AND available_at <= now()
         AND (locked_until IS NULL OR locked_until < now())
         AND attempts < ${MAX_DISPATCH_ATTEMPTS}
       ORDER BY created_at, id
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED)
    UPDATE outbox_events AS o
       SET locked_until = now() + make_interval(secs => ${LEASE_SECONDS}),
           available_at = now() + make_interval(
             secs => LEAST(${MAX_DELAY_SECONDS}, ${BASE_DELAY_SECONDS} * power(2, o.attempts))),
           attempts = o.attempts + 1
      FROM picked
     WHERE o.id = picked.id
    RETURNING o.id, o.type, o.aggregate_type, o.aggregate_id, o.payload, o.attempts, o.created_at`;

  if (rows.length === 0) return { leased: 0, dispatched: 0, failed: 0 };

  const events: LeasedEvent[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    attempts: row.attempts,
    createdAt: row.created_at,
  }));

  const delivered: LeasedEvent[] = [];
  const rejected: Array<{ event: LeasedEvent; message: string }> = [];

  try {
    await send(events);
    delivered.push(...events);
  } catch (batchError) {
    if (events.length === 1) {
      rejected.push({ event: events[0]!, message: errorMessage(batchError) });
    } else {
      logger.warn(
        { err: batchError, count: events.length },
        'outbox batch rejected; sending one by one',
      );
      for (const event of events) {
        try {
          await send([event]);
          delivered.push(event);
        } catch (error) {
          rejected.push({ event, message: errorMessage(error) });
        }
      }
    }
  }

  if (delivered.length > 0) {
    await client.$executeRaw`
      UPDATE outbox_events
         SET status = 'dispatched', dispatched_at = now(), locked_until = NULL, last_error = NULL
       WHERE id = ANY(${delivered.map((e) => e.id)}::uuid[]) AND status = 'pending'`;
  }

  let failed = 0;
  for (const { event, message } of rejected) {
    const exhausted = event.attempts >= MAX_DISPATCH_ATTEMPTS;
    if (exhausted) failed += 1;
    logger.warn(
      { eventId: event.id, attempts: event.attempts, exhausted },
      'outbox event not delivered',
    );
    // available_at already holds the backoff set when the row was leased
    await client.$executeRaw`
      UPDATE outbox_events
         SET status = ${exhausted ? 'failed' : 'pending'}::outbox_status,
             locked_until = NULL,
             last_error = ${message.slice(0, 500)}
       WHERE id = ${event.id}::uuid AND status = 'pending'`;
  }

  return { leased: events.length, dispatched: delivered.length, failed };
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
