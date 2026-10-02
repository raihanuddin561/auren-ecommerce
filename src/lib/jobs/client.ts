import 'server-only';
import { Inngest } from 'inngest';
import { env, isProduction } from '../env';

/**
 * The single Inngest client. Locally it talks to the Inngest dev server (`INNGEST_DEV=1`);
 * in production it needs INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({
  id: 'auren',
  isDev: env.INNGEST_DEV ? env.INNGEST_DEV === '1' : !isProduction,
  ...(env.INNGEST_EVENT_KEY ? { eventKey: env.INNGEST_EVENT_KEY } : {}),
  ...(env.INNGEST_BASE_URL ? { baseUrl: env.INNGEST_BASE_URL } : {}),
});

/** Name of the Inngest event that carries one outbox row. */
export const outboxEventEnvelope = (row: {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  createdAt: Date;
}) => ({
  // Inngest de-duplicates events that share an id, so a lease that expires and re-sends is harmless.
  id: row.id,
  name: row.type,
  data: {
    outboxId: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    occurredAt: row.createdAt.toISOString(),
    payload: row.payload,
  },
});
