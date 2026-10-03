import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import {
  LONGEST_VOLUME_WINDOW_MINUTES,
  VOLUME_ACTIONS,
  capAlerts,
  evaluateSingleRowAlerts,
  evaluateVolumeAlerts,
  type Alert,
} from './alerts';
import * as repo from './repository';
import { toSnapshot } from './snapshot';
import type { AuditInput } from './types';

const ACTION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

const orNull = (value: unknown): Prisma.InputJsonValue | null =>
  value === undefined || value === null ? null : (toSnapshot(value) as Prisma.InputJsonValue);

/**
 * Records one admin change. Call it inside the same transaction as the change so the trail and the
 * data can never disagree (INV-A2):
 *
 *   await db.$transaction(async (tx) => {
 *     const after = await repo.update(tx, id, patch);
 *     await audit(tx, { actorId: staff.userId, action: 'product.update', entity: 'product', entityId: id, before, after });
 *   });
 */
export async function audit(tx: Tx, input: AuditInput): Promise<string> {
  if (!ACTION_PATTERN.test(input.action)) {
    throw new DomainError(
      'VALIDATION',
      `Audit action must look like "order.confirm": ${input.action}`,
    );
  }
  if (!input.entity || !input.entityId) {
    throw new DomainError('VALIDATION', 'Audit needs an entity and an entity id');
  }
  const row = await repo.insert(tx, {
    actorId: input.actorId,
    action: input.action,
    entityType: input.entity,
    entityId: input.entityId,
    before: orNull(input.before),
    after: orNull(input.after),
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
  });
  return row.id;
}

/** Newest first. Used by the audit viewer and by entity detail screens. */
export async function historyFor(tx: Tx, entity: string, entityId: string, limit?: number) {
  return repo.listForEntity(tx, entity, entityId, limit);
}

// ---------------------------------------------------------------------------------------------
// Alert scan (insider risk)
// ---------------------------------------------------------------------------------------------

const CURSOR_KEY = 'security.alerts.cursor';
const SEEN_KEY = 'security.alerts.seen';
const COOLDOWN_KEY = 'security.alerts.cooldowns';
const SCAN_LOCK_ID = 740_011;
const FIRST_RUN_MINUTES = 10;
const MAX_CATCH_UP_MINUTES = 6 * 60;
/** Rows are re-read this far behind the cursor so a transaction that committed late is not missed. */
const OVERLAP_MINUTES = 2;
const MAX_ROWS = 5_000;
const MAX_SEEN_IDS = 3_000;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Scans the audit trail for risky staff activity and raises one `security.alert` outbox event per
 * alert (ids and counts only). Single-row rules look at rows since the last scan (with a small
 * overlap, de-duplicated by id); volume rules always look back over their whole window, so an
 * insider cannot stay under a threshold by spreading actions across scans, and each person and
 * rule alerts at most once per window. Everything runs in one transaction under an advisory lock,
 * so an alert is neither lost nor raised twice and two overlapping runs cannot both act.
 */
export async function scanAuditForAlerts(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<Alert[]> {
  return client.$transaction(
    async (tx) => {
      if (!(await repo.tryScanLock(tx, SCAN_LOCK_ID))) return [];

      const cursorRaw = await repo.readScanState(tx, CURSOR_KEY);
      const cursor = typeof cursorRaw === 'string' ? new Date(cursorRaw) : null;
      const floor = new Date(now.getTime() - MAX_CATCH_UP_MINUTES * 60_000);
      const since =
        cursor && !Number.isNaN(cursor.getTime())
          ? new Date(Math.max(cursor.getTime() - OVERLAP_MINUTES * 60_000, floor.getTime()))
          : new Date(now.getTime() - FIRST_RUN_MINUTES * 60_000);

      const rows = await repo.listForAlerts(tx, since, now, MAX_ROWS);
      const seen = new Set(stringList(await repo.readScanState(tx, SEEN_KEY)));
      const fresh = rows.filter((row) => !seen.has(row.id));
      const alerts = evaluateSingleRowAlerts(fresh);

      const windowStart = new Date(now.getTime() - LONGEST_VOLUME_WINDOW_MINUTES * 60_000);
      const cooldownsRaw = await repo.readScanState(tx, COOLDOWN_KEY);
      const cooldowns: Record<string, string> =
        cooldownsRaw && typeof cooldownsRaw === 'object' && !Array.isArray(cooldownsRaw)
          ? (cooldownsRaw as Record<string, string>)
          : {};
      const volumeRows = await repo.listByActionsSince(tx, VOLUME_ACTIONS, windowStart);
      for (const alert of evaluateVolumeAlerts(volumeRows)) {
        const key = `${alert.rule}:${alert.actorId}`;
        const last = cooldowns[key] ? new Date(cooldowns[key]!).getTime() : 0;
        if (now.getTime() - last < (alert.windowMinutes ?? 60) * 60_000) continue;
        cooldowns[key] = now.toISOString();
        alerts.push(alert);
      }

      const toSend = capAlerts(alerts);
      for (const alert of toSend) {
        await enqueueEvent(tx, {
          type: 'security.alert',
          aggregateType: 'security_alert',
          aggregateId: alert.auditLogId ?? alert.actorId ?? alert.rule,
          payload: alert,
        });
      }

      // A full page means there is more: continue from the last row instead of skipping ahead.
      const next = rows.length === MAX_ROWS ? rows[rows.length - 1]!.createdAt : now;
      await repo.writeScanState(tx, CURSOR_KEY, next.toISOString());
      await repo.writeScanState(
        tx,
        SEEN_KEY,
        [...seen, ...rows.map((row) => row.id)].slice(-MAX_SEEN_IDS),
      );
      const keepAfter = now.getTime() - 24 * 3_600_000;
      await repo.writeScanState(
        tx,
        COOLDOWN_KEY,
        Object.fromEntries(
          Object.entries(cooldowns).filter(([, at]) => new Date(at).getTime() > keepAfter),
        ),
      );
      return toSend;
    },
    { timeout: 30_000, maxWait: 5_000 },
  );
}
