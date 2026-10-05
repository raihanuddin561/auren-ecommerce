'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { rateLimit, hashIdentifier } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { writeOrderProof } from './cookie';
import {
  GENERIC_NOT_FOUND,
  lookupOrderSchema,
  unlockOrderSchema,
  confirmOrderSchema,
  holdOrderSchema,
  cancelOrderSchema,
} from './schemas';
import * as orders from './service';
import type { MinimalOrderView } from './types';
import { confirmOrderStaff, holdOrderStaff, cancelOrderStaff } from './verification';

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

/**
 * Confirms an order after staff verification (ADR-015, INV-O1).
 * Requires staff with 'orders.verify' permission.
 */
export async function confirmOrderAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof confirmOrderStaff>>>> {
  const staff = await requireStaff();
  assertPermission(staff, 'orders.verify');

  const parsed = confirmOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await confirmOrderStaff({
      orderId: parsed.data.orderId,
      staffId: staff.id,
      note: parsed.data.note,
    });
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Puts an order on hold (e.g. unreachable phone).
 * Requires staff with 'orders.verify' permission.
 */
export async function holdOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; orderNumber: string; status: 'on_hold' }>> {
  const staff = await requireStaff();
  assertPermission(staff, 'orders.verify');

  const parsed = holdOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await holdOrderStaff({
      orderId: parsed.data.orderId,
      staffId: staff.id,
      note: parsed.data.note,
      nextAttemptAt: parsed.data.nextAttemptAt,
    });
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Cancels an order with a mandatory reason code (INV-O2).
 * Automatically restocks inventory and flags fake orders.
 * Requires staff with 'orders.verify' permission.
 */
export async function cancelOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; orderNumber: string; status: 'cancelled' }>> {
  const staff = await requireStaff();
  assertPermission(staff, 'orders.verify');

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await cancelOrderStaff({
      orderId: parsed.data.orderId,
      staffId: staff.id,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}
