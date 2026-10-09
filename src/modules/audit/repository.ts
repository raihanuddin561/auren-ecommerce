import type { Tx } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Append-only: this file intentionally has no update or delete (and the database refuses them).
 */
export interface AuditRow {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Prisma.InputJsonValue | null;
  after: Prisma.InputJsonValue | null;
  ip: string | null;
  userAgent: string | null;
}

export async function insert(tx: Tx, row: AuditRow): Promise<{ id: string }> {
  return tx.auditLog.create({
    data: {
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before ?? undefined,
      after: row.after ?? undefined,
      ip: row.ip,
      userAgent: row.userAgent,
    },
    select: { id: true },
  });
}

export async function listForEntity(tx: Tx, entityType: string, entityId: string, limit = 100) {
  return tx.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
}

/** True when an audit row with this action exists for the entity since the given time. */
export async function actionExistsSince(
  tx: Tx,
  entityType: string,
  entityId: string,
  action: string,
  since: Date,
): Promise<boolean> {
  const found = await tx.auditLog.findFirst({
    where: { entityType, entityId, action, createdAt: { gte: since } },
    select: { id: true },
  });
  return found !== null;
}

// ---------------------------------------------------------------------------------------------
// Reading for the alert scan (still no updates or deletes of audit rows)
// ---------------------------------------------------------------------------------------------

export interface AlertRow {
  id: string;
  actorId: string | null;
  action: string;
  createdAt: Date;
}

const alertSelect = { id: true, actorId: true, action: true, createdAt: true } as const;

/** Audit rows created in (since, until], oldest first. */
export const listForAlerts = (
  tx: Tx,
  since: Date,
  until: Date,
  limit: number,
): Promise<AlertRow[]> =>
  tx.auditLog.findMany({
    where: { createdAt: { gt: since, lte: until } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: alertSelect,
  });

/** Rows of the given actions since a time, for the rules that count events over a window. */
export const listByActionsSince = (
  tx: Tx,
  actions: readonly string[],
  since: Date,
): Promise<AlertRow[]> =>
  tx.auditLog.findMany({
    where: { action: { in: [...actions] }, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    take: 10_000,
    select: alertSelect,
  });

/** The scan keeps its own small state (cursor, recently seen ids, cooldowns) in store_settings. */
export async function readScanState(tx: Tx, key: string): Promise<unknown> {
  const row = await tx.storeSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function writeScanState(
  tx: Tx,
  key: string,
  value: Prisma.InputJsonValue,
): Promise<void> {
  await tx.storeSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Only one scan at a time: returns false if another transaction holds the lock. */
export async function tryScanLock(tx: Tx, lockId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_xact_lock(${lockId}::bigint) AS locked`;
  return rows[0]?.locked === true;
}

// ---------------------------------------------------------------------------------------------
// Admin Audit Trail Viewing (15.5)
// ---------------------------------------------------------------------------------------------

export async function listAuditLogsForAdmin(
  tx: Tx,
  filter: {
    entityType?: string;
    action?: string;
    actorId?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(10, filter.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
  };

  const [totalCount, rows, distinctTypes, distinctActions] = await Promise.all([
    tx.auditLog.count({ where }),
    tx.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    tx.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      take: 50,
    }),
    tx.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      take: 100,
    }),
  ]);

  const actorIds = [
    ...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))),
  ];
  const staffMembers =
    actorIds.length > 0
      ? await tx.staffMember.findMany({
          where: { id: { in: actorIds } },
          include: { user: { select: { name: true, email: true } } },
        })
      : [];

  const staffMap = new Map(
    staffMembers.map((s) => [s.id, { name: s.user.name, email: s.user.email }]),
  );

  const items = rows.map((row) => {
    const staff = row.actorId ? staffMap.get(row.actorId) : null;
    return {
      id: row.id,
      actorId: row.actorId,
      actorName: staff?.name ?? null,
      actorEmail: staff?.email ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  });

  return {
    items,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    availableEntityTypes: distinctTypes.map((t) => t.entityType).sort(),
    availableActions: distinctActions.map((a) => a.action).sort(),
  };
}
