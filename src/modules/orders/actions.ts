'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission, hasPermission, type StaffContext } from '@/lib/permissions';
import { rateLimit, hashIdentifier } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { writeOrderProof } from './cookie';
import { editOrderStaff } from './edit';
import {
  GENERIC_NOT_FOUND,
  addOrderNoteSchema,
  assignOrderSchema,
  cancelOrderSchema,
  claimOrderSchema,
  confirmOrderSchema,
  editOrderSchema,
  holdOrderSchema,
  lookupOrderSchema,
  releaseOrderSchema,
  searchVariantsSchema,
  unlockOrderSchema,
} from './schemas';
import * as orders from './service';
import type { SellableHit } from './admin-types';
import { searchSellableVariants } from './workspace';
import type { MinimalOrderView } from './types';
import {
  addNoteStaff,
  assignOrderStaff,
  cancelOrderStaff,
  claimOrderStaff,
  confirmOrderStaff,
  holdOrderStaff,
  releaseOrderStaff,
  type Verifier,
} from './verification';

/**
 * Guest order lookup: order number plus the phone or email on the order. It answers with the
 * status only (no items, no address) and with one generic message for every kind of mismatch, so
 * order numbers cannot be probed (INV-O10). Rate limited per address and per order number.
 */
export async function lookupOrder(
  input: unknown,
): Promise<ActionResult<{ order: MinimalOrderView }>> {
  const parsed = lookupOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const byAddress = await rateLimit('orderLookup', ip);
    const byTarget = await rateLimit('orderLookupTarget', hashIdentifier(parsed.data.orderNumber));
    if (!byAddress.success || !byTarget.success) return fail('RATE_LIMITED');
    if (turnstileEnabled() && !(await verifyTurnstile(parsed.data.turnstileToken ?? null, ip))) {
      return fail('VALIDATION', 'Please complete the check and try again.');
    }
    const order = await orders.lookupMinimal(parsed.data.orderNumber, parsed.data.factor);
    return order ? ok({ order }) : fail('NOT_FOUND', GENERIC_NOT_FOUND);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Opens the full order page for a tracking link: the phone or email on the order is the second
 * factor. On success this browser receives a signed proof cookie for that order only.
 */
export async function unlockOrder(input: unknown): Promise<ActionResult<{ unlocked: true }>> {
  const parsed = unlockOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const byAddress = await rateLimit('orderLookup', ip);
    const byTarget = await rateLimit('orderLookupTarget', hashIdentifier(parsed.data.token));
    if (!byAddress.success || !byTarget.success) return fail('RATE_LIMITED');
    if (turnstileEnabled() && !(await verifyTurnstile(parsed.data.turnstileToken ?? null, ip))) {
      return fail('VALIDATION', 'Please complete the check and try again.');
    }
    const orderId = await orders.verifyTokenFactor(parsed.data.token, parsed.data.factor);
    if (!orderId) return fail('NOT_FOUND', GENERIC_NOT_FOUND);
    await writeOrderProof(orderId);
    return ok({ unlocked: true });
  } catch (error) {
    return toActionError(error);
  }
}

// ---------------------------------------------------------------------------------------------
// Staff: verification (orders.verify). The actor always comes from the session, never from input.
// ---------------------------------------------------------------------------------------------

/** Managers may assign and take over orders: they can decide approvals and update orders. */
const isQueueManager = (staff: StaffContext) =>
  hasPermission(staff, 'approvals.decide') && hasPermission(staff, 'orders.update');

async function verifierContext(staff: StaffContext): Promise<Verifier> {
  const meta = await getRequestMeta();
  return {
    staffId: staff.id,
    userId: staff.userId,
    manager: isQueueManager(staff),
    canVerify: hasPermission(staff, 'orders.verify'),
    canCancel: hasPermission(staff, 'orders.cancel'),
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

function refresh(orderId: string) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/verification');
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function claimOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; claimExpiresAt: string }>> {
  const parsed = claimOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    const result = await claimOrderStaff({
      orderId: parsed.data.orderId,
      verifier: await verifierContext(staff),
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, claimExpiresAt: result.claimExpiresAt.toISOString() });
  } catch (error) {
    return toActionError(error);
  }
}

export async function releaseOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = releaseOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    const result = await releaseOrderStaff({
      orderId: parsed.data.orderId,
      verifier: await verifierContext(staff),
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId });
  } catch (error) {
    return toActionError(error);
  }
}

/** A manager gives an order to a team member. */
export async function assignOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = assignOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    assertPermission(staff, 'orders.update');
    const result = await assignOrderStaff({
      orderId: parsed.data.orderId,
      assigneeId: parsed.data.assigneeId,
      verifier: await verifierContext(staff),
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Confirms an order after staff verification (ADR-015, INV-O1). The full checklist is part of the
 * request and the server refuses anything less; the confirming staff member is the session's.
 * One order per call: there is no bulk confirm.
 */
export async function confirmOrderAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof confirmOrderStaff>>>> {
  const parsed = confirmOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    const result = await confirmOrderStaff({
      orderId: parsed.data.orderId,
      checklist: parsed.data.checklist,
      channel: parsed.data.channel,
      note: parsed.data.note,
      verifier: await verifierContext(staff),
    });
    refresh(parsed.data.orderId);
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

/** Call back later, no answer, busy, wrong number: logs the attempt and holds the order. */
export async function holdOrderAction(
  input: unknown,
): Promise<
  ActionResult<
    Pick<Awaited<ReturnType<typeof holdOrderStaff>>, 'orderId' | 'orderNumber' | 'status'>
  >
> {
  const parsed = holdOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    const result = await holdOrderStaff({
      orderId: parsed.data.orderId,
      outcome: parsed.data.outcome,
      channel: parsed.data.channel,
      note: parsed.data.note,
      nextAttemptAt: parsed.data.nextAttemptAt,
      verifier: await verifierContext(staff),
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, orderNumber: result.orderNumber, status: result.status });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Cancels an order with a mandatory reason (INV-O2). Verification statuses need orders.verify; a
 * confirmed or processing order needs orders.cancel. Releases stock and requests a refund for a
 * paid order; the refund itself needs orders.refund.
 */
export async function cancelOrderAction(
  input: unknown,
): Promise<
  ActionResult<
    Pick<Awaited<ReturnType<typeof cancelOrderStaff>>, 'orderId' | 'orderNumber' | 'status'>
  >
> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    if (!hasPermission(staff, 'orders.verify') && !hasPermission(staff, 'orders.cancel')) {
      assertPermission(staff, 'orders.cancel');
    }
    const result = await cancelOrderStaff({
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      note: parsed.data.note,
      verifier: await verifierContext(staff),
    });
    for (const tag of result.tags) updateTag(tag);
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, orderNumber: result.orderNumber, status: result.status });
  } catch (error) {
    return toActionError(error);
  }
}

/** Edit-then-confirm: change lines or the address at the customer's request, re-priced on the server. */
export async function editOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; totalChanged: boolean }>> {
  const parsed = editOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.verify');
    assertPermission(staff, 'orders.update');
    const result = await editOrderStaff({
      ...parsed.data,
      verifier: await verifierContext(staff),
    });
    for (const tag of result.tags) updateTag(tag);
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, totalChanged: result.totalChanged });
  } catch (error) {
    return toActionError(error);
  }
}

export async function addOrderNoteAction(input: unknown): Promise<ActionResult<{ added: true }>> {
  const parsed = addOrderNoteSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.update');
    await addNoteStaff({
      orderId: parsed.data.orderId,
      note: parsed.data.note,
      verifier: { staffId: staff.id, userId: staff.userId },
    });
    refresh(parsed.data.orderId);
    return ok({ added: true });
  } catch (error) {
    return toActionError(error);
  }
}

/** Variant search for order screens (edit and manual entry): sellable variants only. */
export async function searchOrderVariants(input: unknown): Promise<ActionResult<SellableHit[]>> {
  const parsed = searchVariantsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.update');
    return ok(await searchSellableVariants(parsed.data.q));
  } catch (error) {
    return toActionError(error);
  }
}
