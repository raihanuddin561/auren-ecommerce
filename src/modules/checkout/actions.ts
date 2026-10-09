'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { hashIdentifier, rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { normalizeBdPhone } from '@/lib/phone';
import { requireStaff } from '@/lib/staff';
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { readCartIdentity } from '@/modules/cart/cookie';
import { writeOrderProof } from '@/modules/orders/cookie';
import { manualOrderSchema } from '@/modules/orders/schemas';
import { placeManualOrder } from './manual';
import { placeOrderSchema, quoteSchema, requestOtpSchema, verifyOtpSchema } from './schemas';
import * as checkout from './service';
import type { CheckoutSummary } from './types';

const CHECK_FAILED = 'Please complete the check and try again.';

/** Delivery options, payment methods and totals for the address entered so far. Read-only. */
export async function quoteCheckout(input: unknown): Promise<ActionResult<CheckoutSummary>> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    if (!(await rateLimit('listingMore', ip)).success) return fail('RATE_LIMITED');
    return ok(await checkout.summarize(await readCartIdentity(), parsed.data));
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Places the order. The bag is found by its cookie; the browser sends contact details, the address
 * and the payment method only. Rate limited per address and per phone, optionally behind
 * Turnstile, and idempotent by key: a repeat returns the same order (INV-O6).
 */
export async function placeOrder(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; redirectTo: string }>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    if (!(await rateLimit('checkoutSubmit', ip)).success) return fail('RATE_LIMITED');
    const phone = normalizeBdPhone(parsed.data.contact.phone);
    if (phone && !(await rateLimit('checkoutPhone', hashIdentifier(phone))).success) {
      return fail('RATE_LIMITED');
    }
    if (turnstileEnabled() && !(await verifyTurnstile(parsed.data.turnstileToken ?? null, ip))) {
      return fail('VALIDATION', CHECK_FAILED);
    }

    const result = await checkout.submit(await readCartIdentity(), parsed.data, { ip });
    for (const tag of result.tags) updateTag(tag);
    // The browser that placed the order may open its confirmation page without typing anything.
    await writeOrderProof(result.orderId);
    return ok({
      orderNumber: result.orderNumber,
      redirectTo: `/track/${result.trackingToken}?placed=1`,
    });
  } catch (error) {
    return toActionError(error);
  }
}

/** Sends a phone code (only when the owner has switched codes on). 3 per 5 minutes per phone. */
export async function requestCheckoutCode(
  input: unknown,
): Promise<ActionResult<{ sent: boolean; required: boolean }>> {
  const parsed = requestOtpSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const phone = normalizeBdPhone(parsed.data.phone);
    if (!phone)
      return fail('VALIDATION', 'Enter a Bangladesh mobile number, for example 01712 345678.');
    const byPhone = await rateLimit('otp', hashIdentifier(phone));
    const byAddress = await rateLimit('otp', ip);
    if (!byPhone.success || !byAddress.success) return fail('RATE_LIMITED');
    if (turnstileEnabled() && !(await verifyTurnstile(parsed.data.turnstileToken ?? null, ip))) {
      return fail('VALIDATION', CHECK_FAILED);
    }
    return ok(await checkout.requestOtp(phone));
  } catch (error) {
    return toActionError(error);
  }
}

/** Checks the phone code. Wrong guesses are limited per phone. */
export async function verifyCheckoutCode(
  input: unknown,
): Promise<ActionResult<{ verified: true }>> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const phone = normalizeBdPhone(parsed.data.phone);
    if (!phone)
      return fail('VALIDATION', 'Enter a Bangladesh mobile number, for example 01712 345678.');
    if (!(await rateLimit('otpVerify', hashIdentifier(phone))).success) return fail('RATE_LIMITED');
    await checkout.verifyOtp(phone, parsed.data.code);
    return ok({ verified: true });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Staff type in an order that came in by phone, Facebook, Instagram, WhatsApp or in store (6.5). It
 * uses the same rules as the website and enters the same verification queue. Needs orders.update.
 */
export async function createManualOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'orders.update');
    const meta = await getRequestMeta();
    const result = await placeManualOrder(
      { staffId: staff.id, userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent },
      parsed.data,
    );
    for (const tag of result.tags) updateTag(tag);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/verification');
    return ok({ orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (error) {
    return toActionError(error);
  }
}
