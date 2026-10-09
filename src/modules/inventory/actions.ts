'use server';

import { updateTag } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import {
  adjustStockSchema,
  costPreviewSchema,
  needsStepUp,
  setCostBasisSchema,
  SET_COST_STEP_UP,
  WRITE_OFF_STEP_UP,
} from './schemas';
import * as inventory from './service';
import type { CostBasisPreviewRow } from './service';

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
      requireSetCostStepUp: () => requireStepUp(staff, SET_COST_STEP_UP),
    });
    for (const tag of result.tags) updateTag(tag);
    const { onHand, reserved, delta } = result.data;
    return ok({ onHand, reserved, delta });
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Gives variants that have no cost a cost basis (one variant, or every variant of a product that is
 * still without cost). Needs inventory.adjust and a fresh step-up; refuses to change an existing cost.
 */
export async function setCostBasis(
  input: unknown,
): Promise<ActionResult<{ updated: number; skipped: number }>> {
  const parsed = setCostBasisSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'inventory.adjust');
    await requireStepUp(staff, SET_COST_STEP_UP);
    const meta = await getRequestMeta();
    const result = await inventory.setCostBasis(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    for (const tag of result.tags) updateTag(tag);
    return ok({ updated: result.updated, skipped: result.skipped });
  } catch (error) {
    return toActionError(error);
  }
}

/** The variants of a product and which ones still lack a cost: the preview before a bulk "set cost". */
export async function previewCostBasis(
  input: unknown,
): Promise<ActionResult<CostBasisPreviewRow[]>> {
  const parsed = costPreviewSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'inventory.read');
    return ok(await inventory.previewProductCost(parsed.data.productId));
  } catch (error) {
    return toActionError(error);
  }
}
