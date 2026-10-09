import { db } from '@/lib/db';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import { getVerificationSettings } from '@/modules/settings/service';
import * as repo from './repository';
import { slaState } from './sla';
import { VERIFICATION_STATUSES } from './state-machine';

/**
 * Manager alerts for orders that wait too long (6.15). It only raises a flag and an alert: it never
 * changes an order's status, and an order that stays unverified stays in the queue, marked overdue,
 * until a person acts on it (INV-O2). Safe to run any number of times: an order is escalated once.
 */
export async function escalateOverdueOrders(
  now: Date = new Date(),
): Promise<{ escalated: number }> {
  const settings = await getVerificationSettings(db);
  // The wall-clock time can never be shorter than the working time, so this is a safe first cut.
  const cutoff = new Date(now.getTime() - settings.slaMinutes * 60_000);
  const candidates = await repo.escalationCandidates(db, VERIFICATION_STATUSES, cutoff);
  let escalated = 0;
  for (const candidate of candidates) {
    if (!slaState(candidate.placedAt, now, settings).overdue) continue;
    await db.$transaction(async (tx) => {
      // The condition makes a second runner a no-op.
      if (!(await repo.flagEscalated(tx, candidate.id, VERIFICATION_STATUSES, now))) return;
      await enqueueEvent(tx, {
        type: 'order.escalated',
        aggregateType: 'order',
        aggregateId: candidate.id,
        payload: { orderId: candidate.id, reason: 'sla_overdue' },
      });
      await audit(tx, {
        actorId: null,
        action: 'order.escalate',
        entity: 'order',
        entityId: candidate.id,
        after: { reason: 'sla_overdue' },
      });
      escalated += 1;
    });
  }
  return { escalated };
}
