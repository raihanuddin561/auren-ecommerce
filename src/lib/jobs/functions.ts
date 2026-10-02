import 'server-only';
import { z } from 'zod';
import { db } from '../db';
import { runOnce } from '../inbox';
import { logger } from '../logger';
import { dispatchPendingEvents } from '../outbox';
import { eventSchemas } from '../events';
import { inngest, outboxEventEnvelope } from './client';

/** Cron: forwards pending outbox rows to Inngest. Runs every minute as the safety net. */
export const outboxDispatcher = inngest.createFunction(
  { id: 'outbox-dispatcher', triggers: [{ cron: '* * * * *' }] },
  async () => {
    const summary = await dispatchPendingEvents(db, async (events) => {
      await inngest.send(events.map((event) => outboxEventEnvelope(event)));
    });
    if (summary.leased > 0) logger.info(summary, 'outbox dispatched');
    return summary;
  },
);

const sampleEnvelope = z.object({
  outboxId: z.string().uuid(),
  payload: eventSchemas['system.sample'],
});

/**
 * Reference handler: records that the sample event was handled. It is the template for real
 * handlers: validate the envelope, claim the event with runOnce, do database effects inside it.
 */
export async function handleSampleEvent(data: unknown) {
  const { outboxId, payload } = sampleEnvelope.parse(data);
  return runOnce(db, 'system.sample.recorder', outboxId, async (tx) => {
    await tx.storeSetting.create({
      data: { key: `sample:${outboxId}`, value: { message: payload.message } },
    });
  });
}

export const sampleHandler = inngest.createFunction(
  { id: 'system-sample-recorder', triggers: [{ event: 'system.sample' }], retries: 4 },
  async ({ event }) => handleSampleEvent(event.data),
);

export const functions = [outboxDispatcher, sampleHandler];
