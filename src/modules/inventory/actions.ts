'use server';

import { updateTag } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import { adjustStockSchema, needsStepUp, WRITE_OFF_STEP_UP } from './schemas';
import * as inventory from './service';

/**
 * Manual stock adjustment: count correction, found stock, damage, loss or write-off. Needs
 * inventory.adjust; write-offs also need a fresh step-up confirmation. Audited by the service.
 */
export async function adjustStock(
  input: unknown,
): Promise<ActionResult<{ onHand: number; reserved: number; delta: number }>> {
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'inventory.adjust');
    if (needsStepUp(parsed.data)) await requireStepUp(staff, WRITE_OFF_STEP_UP);
    const meta = await getRequestMeta();
    const result = await inventory.adjustStock(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    for (const tag of result.tags) updateTag(tag);
    const { onHand, reserved, delta } = result.data;
    return ok({ onHand, reserved, delta });
  } catch (error) {
    return toActionError(error);
  }
}
