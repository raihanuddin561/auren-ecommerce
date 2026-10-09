'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { fromDecimalString } from '@/lib/money';
import { assertPermission, type StaffContext } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import {
  REFUND_STEP_UP,
  declineRefundSchema,
  refundOrderSchema,
  requestRefundApprovalSchema,
} from './schemas';
import {
  declineRefundStaff,
  refundOrderStaff,
  requestRefundApprovalStaff,
  type RefundStaff,
} from './refunds';

async function refundStaff(staff: StaffContext): Promise<RefundStaff> {
  const meta = await getRequestMeta();
  return { staffId: staff.id, userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent };
}

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}

/**
 * Records a refund (full or partial), or processes the request a cancelled paid order created.
 * Needs orders.refund and a fresh step-up. Above the threshold a second person must have approved
 * it first (the service refuses otherwise). The same idempotency key never refunds twice.
 */
export async function refundOrderAction(
  input: unknown,
): Promise<ActionResult<{ refundId: string; paymentStatus: string }>> {
  const parsed = refundOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.refund');
    await requireStepUp(staff, REFUND_STEP_UP);
    const actor = await refundStaff(staff);
    const result = await refundOrderStaff({
      orderId: parsed.data.orderId,
      ...(parsed.data.amount ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.refundId ? { refundId: parsed.data.refundId } : {}),
      method: parsed.data.method,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
      providerRef: parsed.data.providerRef ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
      staff: actor,
    });
    refresh(parsed.data.orderId);
    return ok({ refundId: result.refundId, paymentStatus: result.paymentStatus });
  } catch (error) {
    return toActionError(error);
  }
}

/** Not going ahead with a refund request. Needs orders.refund; audited. */
export async function declineRefundAction(
  input: unknown,
): Promise<ActionResult<{ declined: true }>> {
  const parsed = declineRefundSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.refund');
    const actor = await refundStaff(staff);
    await declineRefundStaff({
      refundId: parsed.data.refundId,
      orderId: parsed.data.orderId,
      note: parsed.data.note,
      staff: actor,
    });
    refresh(parsed.data.orderId);
    return ok({ declined: true });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Asks a manager to approve a refund above the threshold (maker-checker). Needs orders.refund and a
 * fresh step-up. The request names this order and amount; approval is good for one refund.
 */
export async function requestRefundApprovalAction(
  input: unknown,
): Promise<ActionResult<{ requested: boolean; approvalId: string | null }>> {
  const parsed = requestRefundApprovalSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.refund');
    await requireStepUp(staff, REFUND_STEP_UP);
    const amountMinor = fromDecimalString(parsed.data.amount, 'BDT').minor;
    const result = await requestRefundApprovalStaff(staff, {
      orderId: parsed.data.orderId,
      amountMinor,
      currency: 'BDT',
      reason: parsed.data.reason,
    });
    revalidatePath('/admin/approvals');
    return ok({
      requested: result.required,
      approvalId: result.required ? result.request.id : null,
    });
  } catch (error) {
    return toActionError(error);
  }
}
