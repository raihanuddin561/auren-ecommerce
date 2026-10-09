'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { hashIdentifier, rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { readCartIdentity } from '@/modules/cart/cookie';
import {
  applyCouponSchema,
  createDiscountSchema,
  toggleDiscountSchema,
  updateDiscountSchema,
} from './schemas';
import * as service from './service';
import type { DiscountRecord } from './types';

// ---------------------------------------------------------------------------------------------
// Storefront Actions (rate-limited via couponApply, generic failure messages)
// ---------------------------------------------------------------------------------------------

export async function applyDiscountCodeAction(
  input: unknown,
): Promise<ActionResult<{ code: string; title: string }>> {
  const parsed = applyCouponSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { ip } = await getRequestMeta();
  const limiterKey = ip ? hashIdentifier(ip) : 'anonymous';
  const limiter = await rateLimit('couponApply', limiterKey);
  if (!limiter.success) {
    return fail('RATE_LIMITED', service.GENERIC_COUPON_ERROR);
  }

  try {
    const identity = await readCartIdentity();
    const result = await service.applyCouponToCart(identity, parsed.data.code);
    revalidatePath('/checkout');
    revalidatePath('/cart');
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeDiscountCodeAction(): Promise<ActionResult<{ success: boolean }>> {
  try {
    const identity = await readCartIdentity();
    await service.removeCouponFromCart(identity);
    revalidatePath('/checkout');
    revalidatePath('/cart');
    return ok({ success: true });
  } catch (error) {
    return toActionError(error);
  }
}

// ---------------------------------------------------------------------------------------------
// Admin Console Actions (Staff Guarded with promotions.manage)
// ---------------------------------------------------------------------------------------------

export async function createDiscountAction(input: unknown): Promise<ActionResult<DiscountRecord>> {
  const staff = await requireStaff();
  assertPermission(staff, 'promotions.manage');

  const parsed = createDiscountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const record = await service.createDiscount(parsed.data);
    revalidatePath('/admin/promotions');
    return ok(record);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateDiscountAction(input: unknown): Promise<ActionResult<DiscountRecord>> {
  const staff = await requireStaff();
  assertPermission(staff, 'promotions.manage');

  const parsed = updateDiscountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const record = await service.updateDiscount(parsed.data);
    revalidatePath('/admin/promotions');
    return ok(record);
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleDiscountAction(input: unknown): Promise<ActionResult<DiscountRecord>> {
  const staff = await requireStaff();
  assertPermission(staff, 'promotions.manage');

  const parsed = toggleDiscountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const record = await service.setDiscountActive(parsed.data.id, parsed.data.isActive);
    revalidatePath('/admin/promotions');
    return ok(record);
  } catch (error) {
    return toActionError(error);
  }
}
