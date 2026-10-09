'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import { ORDER_CHANNEL_FILTERS, ORDER_PAYMENT_FILTERS } from './admin-types';
import { COURIER_CHOICES } from './fulfilment-schemas';
import {
  bulkBookCourier,
  bulkStartPicking,
  deleteOrderView,
  exportOrdersCsv,
  saveOrderView,
  type BulkResult,
} from './list';
import { ORDERS_EXPORT_STEP_UP } from './list-schemas';

const filters = z
  .object({
    status: z
      .enum([
        'awaiting_verification',
        'ready_to_ship',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'delivery_failed',
        'returned_to_origin',
        'completed',
        'return_requested',
        'returned',
        'refunded',
        'exchanged',
        'cancelled',
      ])
      .optional(),
    q: z.string().trim().max(80).optional(),
    payment: z.enum(ORDER_PAYMENT_FILTERS).optional(),
    channel: z.enum(ORDER_CHANNEL_FILTERS).optional(),
    assignee: z.string().trim().max(40).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

/**
 * Exports the orders that match the list filters as CSV text. Needs orders.read and a fresh step-up
 * (the file holds customer phone numbers), is capped, guards against spreadsheet formulas, is
 * audited with who, the filter and the row count, and is returned to the caller: there is no link
 * to share (18.9).
 */
export async function exportOrdersCsvAction(
  input: unknown,
): Promise<ActionResult<{ csv: string; rows: number; filename: string }>> {
  const parsed = filters.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.read');
    await requireStepUp(staff, ORDERS_EXPORT_STEP_UP);
    const meta = await getRequestMeta();
    return ok(
      await exportOrdersCsv(parsed.data, {
        userId: staff.userId,
        staffId: staff.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    );
  } catch (error) {
    return toActionError(error);
  }
}

const bulkIds = z.array(z.uuid()).min(1).max(50);

async function fulfillerOf(staff: Awaited<ReturnType<typeof requireStaff>>) {
  const meta = await getRequestMeta();
  return { staffId: staff.id, userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent };
}

/** Start picking for several confirmed orders. Orders that are not confirmed are reported, never touched. */
export async function bulkStartPickingAction(
  input: unknown,
): Promise<ActionResult<{ started: number; skipped: BulkResult['failed'] }>> {
  const parsed = z.object({ orderIds: bulkIds }).strict().safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    const result = await bulkStartPicking(parsed.data.orderIds, await fulfillerOf(staff));
    revalidatePath('/admin/orders');
    return ok({ started: result.done, skipped: result.failed });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Book several confirmed orders with a courier that has an API (Pathao, Steadfast). The manual
 * courier needs a tracking number per parcel, so it is booked one order at a time. An order nobody
 * verified fails its own booking and is reported.
 */
export async function bulkBookCourierAction(
  input: unknown,
): Promise<ActionResult<{ booked: number; failed: BulkResult['failed'] }>> {
  const parsed = z
    .object({
      orderIds: bulkIds,
      courier: z.enum(COURIER_CHOICES.filter((c) => c !== 'manual') as ['pathao', 'steadfast']),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.fulfill');
    assertPermission(staff, 'shipping.manage');
    const result = await bulkBookCourier(
      parsed.data.orderIds,
      parsed.data.courier,
      await fulfillerOf(staff),
    );
    revalidatePath('/admin/orders');
    revalidatePath('/admin/shipping');
    return ok({ booked: result.done, failed: result.failed });
  } catch (error) {
    return toActionError(error);
  }
}

const viewSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    query: z
      .string()
      .max(400)
      .regex(/^[\w\-=&.%:,+ ]*$/, 'Unsupported characters'),
  })
  .strict();

export async function saveOrderViewAction(
  input: unknown,
): Promise<ActionResult<{ views: Array<{ name: string; query: string }> }>> {
  const parsed = viewSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.read');
    const views = await saveOrderView(staff.userId, parsed.data.name, parsed.data.query);
    revalidatePath('/admin/orders');
    return ok({ views });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteOrderViewAction(
  input: unknown,
): Promise<ActionResult<{ views: Array<{ name: string; query: string }> }>> {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(40) })
    .strict()
    .safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.read');
    const views = await deleteOrderView(staff.userId, parsed.data.name);
    revalidatePath('/admin/orders');
    return ok({ views });
  } catch (error) {
    return toActionError(error);
  }
}
