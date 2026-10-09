'use server';

import { updateTag } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import {
  HERO_CAROUSEL_CACHE_TAG,
  saveCheckoutSettingsSchema,
  saveOrderRulesSchema,
  saveHeroCarouselSettingsSchema,
  storeGeneralSettingsSchema,
  type StoreGeneralSettings,
} from './schemas';
import * as settings from './service';

/** Cash on delivery rule and checkout abuse limits. Needs settings.manage; audited by the service. */
export async function saveCheckoutSettings(input: unknown): Promise<ActionResult<{ saved: true }>> {
  const parsed = saveCheckoutSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    await settings.saveCheckoutSettings(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    updateTag('shipping');
    return ok({ saved: true });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Saves hero carousel configuration. Requires settings.manage.
 * Revalidates storefront hero carousel tag.
 */
export async function saveHeroCarouselSettingsAction(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = saveHeroCarouselSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    await settings.saveHeroCarouselSettings(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    updateTag(HERO_CAROUSEL_CACHE_TAG);
    return ok({ saved: true });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Uploads an image for the hero carousel/banner slide.
 * Requires settings.manage.
 */
export async function uploadHeroSlideImageAction(
  form: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail('VALIDATION', 'Choose an image file.', { file: ['Choose an image file.'] });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const res = await settings.uploadHeroSlideImage(bytes);
    return ok(res);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Verification rules (working hours, target time, attempt threshold, claim time, whether staff may
 * verify their own manual orders) and the return window. Needs settings.manage; audited.
 */
export async function saveOrderRulesAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  const parsed = saveOrderRulesSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    const { returnWindowDays, ...verification } = parsed.data;
    await settings.saveOrderRules(
      { verification, returns: { windowDays: returnWindowDays } },
      { userId: staff.userId, ip: meta.ip, userAgent: meta.userAgent },
    );
    return ok({ saved: true });
  } catch (error) {
    return toActionError(error);
  }
}

/** Saves general store info and business details. Needs settings.manage. */
export async function saveStoreGeneralSettingsAction(
  input: unknown,
): Promise<ActionResult<StoreGeneralSettings>> {
  const parsed = storeGeneralSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    const result = await settings.saveStoreGeneralSettings(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}
