'use server';

import { updateTag } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { saveCheckoutSettingsSchema } from './schemas';
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
