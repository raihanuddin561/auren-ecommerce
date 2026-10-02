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
