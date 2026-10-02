import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
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
