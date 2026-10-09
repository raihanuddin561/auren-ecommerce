import type { Tx } from '@/lib/db';

export interface ApprovalRow {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  amountMinor: bigint;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  decidedBy: string | null;
  consumedAt: Date | null;
  reason: string | null;
  requestedAt: Date;
}

const select = {
  id: true,
  kind: true,
  subjectType: true,
  subjectId: true,
  amountMinor: true,
  currency: true,
  status: true,
  requestedBy: true,
  decidedBy: true,
  consumedAt: true,
  reason: true,
  requestedAt: true,
} as const;

export const findPending = (tx: Tx, kind: string, subjectType: string, subjectId: string) =>
  tx.approvalRequest.findFirst({
    where: { kind, subjectType, subjectId, status: 'pending' },
    select,
  });

export const insert = (
  tx: Tx,
  row: {
    kind: string;
    subjectType: string;
    subjectId: string;
    amountMinor: bigint;
    currency: string;
    requestedBy: string;
    reason: string | null;
  },
): Promise<ApprovalRow> => tx.approvalRequest.create({ data: row, select });

/** Locks the row so two deciders cannot both act on it. */
export async function lockById(tx: Tx, id: string): Promise<ApprovalRow | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM approval_requests WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) return null;
  return tx.approvalRequest.findUnique({ where: { id }, select });
}

export const decide = (
  tx: Tx,
  id: string,
  data: { status: 'approved' | 'rejected'; decidedBy: string; decisionNote: string | null },
) =>
  tx.approvalRequest.update({
    where: { id },
    data: { ...data, decidedAt: new Date() },
    select,
  });

/** An approval that covers `amountMinor` for the subject and has not been used yet. */
/** An approval is good for this long after it was decided. */
export const APPROVAL_VALID_DAYS = 7;

export const findUsable = (
  tx: Tx,
  kind: string,
  subjectType: string,
  subjectId: string,
  amountMinor: bigint,
  currency: string,
) =>
  tx.approvalRequest.findFirst({
    where: {
      kind,
      subjectType,
      subjectId,
      status: 'approved',
      consumedAt: null,
      currency,
      amountMinor: { gte: amountMinor },
      decidedAt: { gte: new Date(Date.now() - APPROVAL_VALID_DAYS * 86_400_000) },
    },
    orderBy: { requestedAt: 'asc' },
    select,
  });

/** Marks an approval used. Returns false if someone else used it first. */
export async function consume(tx: Tx, id: string): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE approval_requests SET consumed_at = now()
     WHERE id = ${id}::uuid AND status = 'approved' AND consumed_at IS NULL`;
  return changed === 1;
}

export const listPending = (tx: Tx, limit = 50) =>
  tx.approvalRequest.findMany({
    where: { status: 'pending' },
    orderBy: { requestedAt: 'asc' },
    take: limit,
    select,
  });

export async function readThresholds(tx: Tx): Promise<unknown> {
  const row = await tx.storeSetting.findUnique({ where: { key: 'approvals.thresholds' } });
  return row?.value ?? null;
}
