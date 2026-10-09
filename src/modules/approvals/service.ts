import { z } from 'zod';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { assertPermission, type StaffContext } from '@/lib/permissions';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';

/**
 * Maker-checker for high-value actions. Below the threshold an action needs only its own
 * permission; at or above it a SECOND, different staff member holding approvals.decide must
 * approve first, and the approval is good for exactly one use. The database also refuses a
 * decider that equals the requester, so a bug here cannot let one person do both.
 */

/** Amounts (minor units) from which a second person is required. Owners can change them in settings. */
export const DEFAULT_APPROVAL_THRESHOLDS: Readonly<Record<string, bigint>> = {
  refund: 500_000n,
  stock_adjustment: 1_000_000n,
};

const thresholdsSchema = z.record(
  z.string(),
  z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
);

/**
 * Hard ceilings for the configurable thresholds: nobody can switch maker-checker off by writing a
 * huge number into settings. Raising a ceiling is a code change that goes through review.
 */
export const MAX_APPROVAL_THRESHOLDS: Readonly<Record<string, bigint>> = {
  refund: 5_000_000n,
  stock_adjustment: 10_000_000n,
};
const DEFAULT_MAX_THRESHOLD = 1_000_000n;

export async function thresholdFor(tx: Tx, kind: string): Promise<bigint> {
  const raw = await repo.readThresholds(tx);
  const parsed = thresholdsSchema.safeParse(raw);
  const configured = parsed.success ? parsed.data[kind] : undefined;
  if (configured !== undefined) {
    const ceiling = MAX_APPROVAL_THRESHOLDS[kind] ?? DEFAULT_MAX_THRESHOLD;
    const value = BigInt(configured);
    return value > ceiling ? ceiling : value;
  }
  // Unknown kinds fail safe: everything needs a second person.
  return DEFAULT_APPROVAL_THRESHOLDS[kind] ?? 0n;
}

export const approvalRequired = async (tx: Tx, kind: string, amountMinor: bigint) =>
  amountMinor >= (await thresholdFor(tx, kind));

export interface ApprovalRequestInput {
  kind: string;
  subjectType: string;
  subjectId: string;
  amountMinor: bigint;
  currency: string;
  reason?: string;
}

/**
 * Asks for a second person's approval, unless the amount is below the threshold. Idempotent: an
 * open request for the same subject is returned instead of creating another. The caller has
 * already checked its own permission and step-up (INV-A6).
 */
export async function requestApproval(tx: Tx, staff: StaffContext, input: ApprovalRequestInput) {
  if (input.amountMinor < 0n) throw new DomainError('VALIDATION', 'Amount cannot be negative');
  if (!(await approvalRequired(tx, input.kind, input.amountMinor))) {
    return { required: false as const };
  }
  const existing = await repo.findPending(tx, input.kind, input.subjectType, input.subjectId);
  if (existing) return openRequest(existing, input);

  let request;
  try {
    request = await repo.insert(tx, {
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      requestedBy: staff.id,
      reason: input.reason?.slice(0, 500) ?? null,
    });
  } catch (error) {
    // Two people asked at the same moment: the unique index lets one in, the other joins it.
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const raced = await repo.findPending(tx, input.kind, input.subjectType, input.subjectId);
    if (!raced) throw error;
    return openRequest(raced, input);
  }
  await audit(tx, {
    actorId: staff.userId,
    action: 'approval.request',
    entity: 'approval_request',
    entityId: request.id,
    after: { kind: input.kind, subjectId: input.subjectId, amountMinor: input.amountMinor },
  });
  await enqueueEvent(tx, {
    type: 'approval.requested',
    aggregateType: 'approval_request',
    aggregateId: request.id,
    payload: {
      approvalId: request.id,
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
  });
  return { required: true as const, request, created: true };
}

/** An open request is reused, but not for a larger amount than it was opened for. */
function openRequest(existing: repo.ApprovalRow, input: ApprovalRequestInput) {
  if (existing.amountMinor < input.amountMinor) {
    throw new DomainError(
      'CONFLICT',
      'A smaller request for this is already open. Decide it first, then ask again.',
    );
  }
  return { required: true as const, request: existing, created: false };
}

export async function decideApproval(
  tx: Tx,
  staff: StaffContext,
  input: { id: string; decision: 'approved' | 'rejected'; note?: string },
) {
  assertPermission(staff, 'approvals.decide');
  const request = await repo.lockById(tx, input.id);
  if (!request) throw new DomainError('NOT_FOUND');
  if (request.status !== 'pending') {
    throw new DomainError('CONFLICT', 'That request has already been decided.');
  }
  if (request.requestedBy === staff.id) {
    throw new DomainError('FORBIDDEN', 'You cannot decide a request you made yourself.');
  }
  const decided = await repo.decide(tx, input.id, {
    status: input.decision,
    decidedBy: staff.id,
    decisionNote: input.note?.slice(0, 500) ?? null,
  });
  await audit(tx, {
    actorId: staff.userId,
    action: input.decision === 'approved' ? 'approval.approve' : 'approval.reject',
    entity: 'approval_request',
    entityId: decided.id,
    before: { status: 'pending' },
    after: { status: decided.status, kind: decided.kind, subjectId: decided.subjectId },
  });
  await enqueueEvent(tx, {
    type: 'approval.decided',
    aggregateType: 'approval_request',
    aggregateId: decided.id,
    payload: { approvalId: decided.id, kind: decided.kind, decision: input.decision },
  });
  return decided;
}

/**
 * Call this inside the transaction that performs the high-value action. It passes when the amount
 * is below the threshold, or when an approved, unused request in the same currency covers it and
 * was decided within the last 7 days (and then uses it up). The action that deciding unlocks
 * (the decision itself) must have been confirmed with step-up for purpose `approvals.decide`.
 */
export async function requireApproval(
  tx: Tx,
  input: {
    kind: string;
    subjectType: string;
    subjectId: string;
    amountMinor: bigint;
    currency: string;
  },
): Promise<void> {
  if (input.amountMinor < 0n) throw new DomainError('VALIDATION', 'Amount cannot be negative');
  if (!(await approvalRequired(tx, input.kind, input.amountMinor))) return;
  const usable = await repo.findUsable(
    tx,
    input.kind,
    input.subjectType,
    input.subjectId,
    input.amountMinor,
    input.currency,
  );
  if (!usable || !(await repo.consume(tx, usable.id))) {
    throw new DomainError('APPROVAL_REQUIRED', 'A second person must approve this first.');
  }
}

export const listPendingApprovals = (tx: Tx) => repo.listPending(tx);

/** A second person decides a request (one transaction). The caller checked the permission and step-up. */
export const decideApprovalStaff = (
  staff: StaffContext,
  input: { id: string; decision: 'approved' | 'rejected'; note?: string },
) => db.$transaction((tx) => decideApproval(tx, staff, input));
