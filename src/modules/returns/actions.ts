'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { fromDecimalString } from '@/lib/money';
import { assertPermission, type StaffContext } from '@/lib/permissions';
import { rateLimit, hashIdentifier } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { readOrderProof } from '@/modules/orders/cookie';
import { REFUND_STEP_UP } from '@/modules/payments/schemas';
import {
  approveReturnSchema,
  closeReturnSchema,
  customerReturnSchema,
  inspectReturnSchema,
  receiveReturnSchema,
  rejectReturnSchema,
  resolveReturnSchema,
  shipReplacementSchema,
} from './schemas';
import {
  approveReturnStaff,
  closeReturnStaff,
  inspectReturnStaff,
  receiveReturnStaff,
  rejectReturnStaff,
  requestReturnByToken,
  resolveReturnStaff,
  shipReplacementStaff,
  type ReturnStaff,
} from './service';

const minor = (text: string) => fromDecimalString(text, 'BDT').minor;

async function returnStaff(staff: StaffContext): Promise<ReturnStaff> {
  const meta = await getRequestMeta();
  return { staffId: staff.id, userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent };
}

function refresh(orderId?: string) {
  revalidatePath('/admin/returns');
  revalidatePath('/admin/orders');
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * A customer asks to return or exchange items from their delivered order. The order is found by the
 * private tracking token and only when this browser showed the second factor (the proof cookie), so
 * nobody can open a return on an order they cannot see (INV-O10). Rate limited like order lookup.
 */
export async function requestReturnAction(
  input: unknown,
): Promise<ActionResult<{ returnNumber: string }>> {
  const parsed = customerReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const byAddress = await rateLimit('orderLookup', ip);
    const byTarget = await rateLimit('orderLookupTarget', hashIdentifier(parsed.data.token));
    if (!byAddress.success || !byTarget.success) return fail('RATE_LIMITED');
    if (turnstileEnabled() && !(await verifyTurnstile(parsed.data.turnstileToken ?? null, ip))) {
      return fail('VALIDATION', 'Please complete the check and try again.');
    }
    const result = await requestReturnByToken({
      token: parsed.data.token,
      proof: await readOrderProof(),
      type: parsed.data.type,
      items: parsed.data.items,
      note: parsed.data.note,
    });
    revalidatePath('/admin/returns');
    revalidatePath(`/admin/orders/${result.orderId}`);
    return ok({ returnNumber: result.returnNumber });
  } catch (error) {
    return toActionError(error);
  }
}

async function staffStep<T extends { returnId: string }>(
  work: (staff: ReturnStaff) => Promise<T>,
  options: { orderId?: string } = {},
): Promise<ActionResult<{ returnId: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'returns.manage');
    const result = await work(await returnStaff(staff));
    refresh(options.orderId);
    return ok({ returnId: result.returnId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function approveReturnAction(input: unknown) {
  const parsed = approveReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  return staffStep((staff) =>
    approveReturnStaff({ returnId: parsed.data.returnId, note: parsed.data.note, staff }),
  );
}

export async function rejectReturnAction(input: unknown) {
  const parsed = rejectReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  return staffStep((staff) =>
    rejectReturnStaff({ returnId: parsed.data.returnId, reason: parsed.data.reason, staff }),
  );
}

export async function receiveReturnAction(input: unknown) {
  const parsed = receiveReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  return staffStep((staff) =>
    receiveReturnStaff({
      returnId: parsed.data.returnId,
      shippingCostMinor: minor(parsed.data.shippingCost),
      staff,
    }),
  );
}

/** Staff inspect each returned item: resellable goods go back on the shelf, damaged goods are written off. */
export async function inspectReturnAction(input: unknown) {
  const parsed = inspectReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'returns.manage');
    const result = await inspectReturnStaff({
      returnId: parsed.data.returnId,
      conditions: parsed.data.conditions,
      note: parsed.data.note,
      staff: await returnStaff(staff),
    });
    for (const tag of result.tags) updateTag(tag);
    refresh();
    return ok({ returnId: result.returnId });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Settles an inspected return as a refund, store credit or an exchange. Money going back needs
 * orders.refund and a fresh step-up on top of returns.manage; an exchange needs only returns.manage.
 */
export async function resolveReturnAction(input: unknown) {
  const parsed = resolveReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'returns.manage');
    if (parsed.data.resolution !== 'exchange') {
      assertPermission(staff, 'orders.refund');
      await requireStepUp(staff, REFUND_STEP_UP);
    }
    const actor = await returnStaff(staff);
    const result = await resolveReturnStaff({
      returnId: parsed.data.returnId,
      resolution: parsed.data.resolution,
      amount: parsed.data.amount,
      refundMethod: parsed.data.refundMethod,
      providerRef: parsed.data.providerRef,
      note: parsed.data.note,
      idempotencyKey: parsed.data.idempotencyKey,
      staff: actor,
    });
    for (const tag of result.tags) updateTag(tag);
    refresh();
    return ok({ returnId: result.returnId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function closeReturnAction(input: unknown) {
  const parsed = closeReturnSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  return staffStep((staff) =>
    closeReturnStaff({ returnId: parsed.data.returnId, note: parsed.data.note, staff }),
  );
}

/** Record the replacement parcel of an exchange. Needs shipping.manage and returns.manage. */
export async function shipReplacementAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = shipReplacementSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'returns.manage');
    assertPermission(staff, 'shipping.manage');
    const meta = await getRequestMeta();
    const result = await shipReplacementStaff({
      orderId: parsed.data.orderId,
      courierName: parsed.data.courierName,
      trackingNumber: parsed.data.trackingNumber,
      costMinor: minor(parsed.data.cost),
      fulfiller: {
        staffId: staff.id,
        userId: staff.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId });
  } catch (error) {
    return toActionError(error);
  }
}
