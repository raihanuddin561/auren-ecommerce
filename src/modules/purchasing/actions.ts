'use server';

import { updateTag } from 'next/cache';
import type { z } from 'zod';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import {
  addLandedCostSchema,
  cancelPurchaseOrderSchema,
  createPurchaseOrderSchema,
  purchaseOrderIdSchema,
  receiveGoodsSchema,
  removeLandedCostSchema,
  searchVariantsSchema,
  supplierFieldsSchema,
  updatePurchaseOrderSchema,
  updateSupplierSchema,
} from './schemas';
import * as purchasing from './service';
import type { Mutation, PurchasingActor } from './service';

/**
 * Purchasing Server Actions. Guard order for every one: strict Zod parse, authenticate, check
 * purchasing.manage, run the service (which audits in the same transaction), invalidate tags.
 */
async function mutate<S extends z.ZodType, T>(
  input: unknown,
  schema: S,
  run: (data: z.infer<S>, actor: PurchasingActor) => Promise<Mutation<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'purchasing.manage');
    const meta = await getRequestMeta();
    const result = await run(parsed.data, {
      userId: staff.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    for (const tag of result.tags) updateTag(tag);
    return ok(result.data);
  } catch (error) {
    return toActionError(error);
  }
}

export async function createSupplier(input: unknown) {
  return mutate(input, supplierFieldsSchema, (data, actor) =>
    purchasing.createSupplier(data, actor),
  );
}

export async function updateSupplier(input: unknown) {
  return mutate(input, updateSupplierSchema, (data, actor) =>
    purchasing.updateSupplier(data, actor),
  );
}

export async function createPurchaseOrder(input: unknown) {
  return mutate(input, createPurchaseOrderSchema, (data, actor) =>
    purchasing.createPurchaseOrder(data, actor),
  );
}

export async function updatePurchaseOrder(input: unknown) {
  return mutate(input, updatePurchaseOrderSchema, (data, actor) =>
    purchasing.updatePurchaseOrder(data, actor),
  );
}

export async function placePurchaseOrder(input: unknown) {
  return mutate(input, purchaseOrderIdSchema, (data, actor) =>
    purchasing.placeOrder(data.id, actor),
  );
}

export async function cancelPurchaseOrder(input: unknown) {
  return mutate(input, cancelPurchaseOrderSchema, (data, actor) =>
    purchasing.cancelPurchaseOrder(data.id, data.reason, actor),
  );
}

export async function addLandedCost(input: unknown) {
  return mutate(input, addLandedCostSchema, (data, actor) => purchasing.addLandedCost(data, actor));
}

export async function removeLandedCost(input: unknown) {
  return mutate(input, removeLandedCostSchema, (data, actor) =>
    purchasing.removeLandedCost(data.id, actor),
  );
}

export async function receiveGoods(input: unknown) {
  return mutate(input, receiveGoodsSchema, (data, actor) => purchasing.receiveGoods(data, actor));
}

/** Variant search for the order form (read-only, still permission gated). */
export async function searchVariants(
  input: unknown,
): Promise<ActionResult<Array<{ variantId: string; label: string; sku: string; onHand: number }>>> {
  const parsed = searchVariantsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    assertPermission(await requireStaff(), 'purchasing.manage');
    return ok(await purchasing.searchVariantsForOrder(parsed.data.q));
  } catch (error) {
    return toActionError(error);
  }
}
