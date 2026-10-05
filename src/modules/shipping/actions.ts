'use server';

import { updateTag } from 'next/cache';
import { ok, fail, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { listAreasSchema, saveRateSchema, saveZoneSchema } from './schemas';
import * as shipping from './service';

/** Thanas and upazilas of a district, for the cascading address picker. Public, read-only. */
export async function listThanas(
  input: unknown,
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  const parsed = listAreasSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const limited = await rateLimit('listingMore', ip);
    if (!limited.success) return fail('RATE_LIMITED');
    return ok(await shipping.listThanasOf(parsed.data.parentId));
  } catch (error) {
    return toActionError(error);
  }
}

/** Creates or edits a delivery zone. Needs settings.manage; audited by the service. */
export async function saveShippingZone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveZoneSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    const id = await shipping.saveZone(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    updateTag(shipping.SHIPPING_TAG);
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

/** Creates or edits a rate inside a zone. Needs settings.manage; audited by the service. */
export async function saveShippingRate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveRateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'settings.manage');
    const meta = await getRequestMeta();
    const id = await shipping.saveRate(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    updateTag(shipping.SHIPPING_TAG);
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}
