'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { fromDecimalString } from '@/lib/money';
import { assertPermission, type StaffContext } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import {
  addOrderCost,
  applyParcelUpdateStaff,
  receiveReturnToOriginStaff,
  shipOrder,
  startProcessingStaff,
  updateParcelDetailsStaff,
  type Fulfiller,
} from './fulfilment';
import {
  addCostSchema,
  parcelDetailsSchema,
  parcelStatusSchema,
  returnToOriginSchema,
  shipOrderSchema,
  startProcessingSchema,
} from './fulfilment-schemas';

const minor = (text: string) => fromDecimalString(text, 'BDT').minor;

async function fulfillerFor(staff: StaffContext): Promise<Fulfiller> {
  const meta = await getRequestMeta();
  return { staffId: staff.id, userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent };
}

function refresh(orderId: string) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/shipping');
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Start picking a confirmed order. Needs orders.fulfill. */
export async function startProcessingAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = startProcessingSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    const fulfiller = await fulfillerFor(staff);
    const result = await startProcessingStaff({ orderId: parsed.data.orderId, fulfiller });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId });
  } catch (error) {
    return toActionError(error);
  }
}

/** Hand a confirmed order to a courier (or type a manual courier's tracking number). Needs orders.fulfill. */
export async function shipOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; trackingNumber: string }>> {
  const parsed = shipOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    assertPermission(staff, 'shipping.manage');
    const result = await shipOrder({
      orderId: parsed.data.orderId,
      courier: parsed.data.courier,
      courierName: parsed.data.courierName,
      trackingNumber: parsed.data.trackingNumber,
      costMinor: parsed.data.cost ? minor(parsed.data.cost) : undefined,
      weightG: parsed.data.weightG,
      note: parsed.data.note,
      packagingProfileId: parsed.data.packagingProfileId,
      fulfiller: await fulfillerFor(staff),
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, trackingNumber: result.trackingNumber });
  } catch (error) {
    return toActionError(error);
  }
}

/** Staff report where a manual parcel is: picked up, in transit, out for delivery, delivered or failed. */
export async function updateParcelStatusAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; status: string }>> {
  const parsed = parcelStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    assertPermission(staff, 'shipping.manage');
    const fulfiller = await fulfillerFor(staff);
    const result = await applyParcelUpdateStaff({
      orderId: parsed.data.orderId,
      shipmentId: parsed.data.shipmentId,
      status: parsed.data.status,
      description: parsed.data.note ?? null,
      codFeeMinor: parsed.data.codFee ? minor(parsed.data.codFee) : undefined,
      actor: { kind: 'staff', fulfiller },
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId, status: String(result.status) });
  } catch (error) {
    return toActionError(error);
  }
}

/** Correct the courier name, tracking number or courier charges of a parcel. Needs shipping.manage. */
export async function updateParcelDetailsAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = parcelDetailsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'shipping.manage');
    const fulfiller = await fulfillerFor(staff);
    await updateParcelDetailsStaff({
      orderId: parsed.data.orderId,
      shipmentId: parsed.data.shipmentId,
      courierName: parsed.data.courierName,
      trackingNumber: parsed.data.trackingNumber,
      costMinor: parsed.data.cost ? minor(parsed.data.cost) : undefined,
      codFeeMinor: parsed.data.codFee ? minor(parsed.data.codFee) : undefined,
      fulfiller,
    });
    refresh(parsed.data.orderId);
    return ok({ orderId: parsed.data.orderId });
  } catch (error) {
    return toActionError(error);
  }
}

/** The parcel is back with us: restock, record the loss, flag the phone. Needs orders.fulfill. */
export async function receiveReturnToOriginAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = returnToOriginSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    const fulfiller = await fulfillerFor(staff);
    const result = await receiveReturnToOriginStaff({
      orderId: parsed.data.orderId,
      condition: parsed.data.condition,
      lossMinor: minor(parsed.data.loss),
      note: parsed.data.note,
      fulfiller,
    });
    for (const tag of result.tags) updateTag(tag);
    refresh(parsed.data.orderId);
    return ok({ orderId: result.orderId });
  } catch (error) {
    return toActionError(error);
  }
}

/** Add a cost to an order that nothing records automatically. Needs finance.write; audited. */
export async function addOrderCostAction(input: unknown): Promise<ActionResult<{ added: true }>> {
  const parsed = addCostSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');
    const meta = await getRequestMeta();
    await addOrderCost({
      orderId: parsed.data.orderId,
      amountMinor: minor(parsed.data.amount),
      note: parsed.data.note,
      actorUserId: staff.userId,
      actorStaffId: staff.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    refresh(parsed.data.orderId);
    return ok({ added: true });
  } catch (error) {
    return toActionError(error);
  }
}
