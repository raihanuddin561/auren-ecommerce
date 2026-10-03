'use server';

import { updateTag } from 'next/cache';
import type { z } from 'zod';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import {
  assertPermission,
  hasPermission,
  type Permission,
  type StaffContext,
} from '@/lib/permissions';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import { MAX_IMAGE_BYTES } from '@/lib/media/upload';
import { clearRedirectCache } from './redirect-cache';
import * as catalog from './service';
import {
  addCollectionProductsSchema,
  createCategorySchema,
  createCollectionSchema,
  createProductSchema,
  createSizeChartSchema,
  deleteCategorySchema,
  deleteCollectionSchema,
  deleteMediaSchema,
  deleteSizeChartSchema,
  generateVariantsSchema,
  previewRulesSchema,
  productDetailsSchema,
  productStatusSchema,
  refreshCollectionSchema,
  removeCategoryImageSchema,
  removeCollectionHeroSchema,
  removeCollectionProductSchema,
  reorderCategoriesSchema,
  reorderCollectionProductsSchema,
  reorderMediaSchema,
  searchPickerSchema,
  updateCategorySchema,
  updateCollectionSchema,
  updateMediaSchema,
  updateSizeChartSchema,
  updateVariantsSchema,
  uploadCategoryImageFieldsSchema,
  uploadCollectionHeroFieldsSchema,
  uploadMediaFieldsSchema,
} from './schemas';
import type { Actor, Mutation } from './types';

/**
 * Catalogue Server Actions. Every one: parse the input with a strict Zod schema, authenticate the
 * staff member, check the permission, run the service (which writes the audit row in the same
 * transaction), then invalidate the cache tags the write touched. Reads and writes need
 * catalog.write; going live or retiring a product needs catalog.publish.
 */

/** Runs one mutation with the standard guard order. */
async function mutate<S extends z.ZodType, T>(
  input: unknown,
  schema: S,
  permission: Permission,
  run: (data: z.infer<S>, actor: Actor, staff: StaffContext) => Promise<Mutation<T>>,
  extraPermission?: (data: z.infer<S>) => Permission | null,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, permission);
    const extra = extraPermission?.(parsed.data);
    if (extra) assertPermission(staff, extra);
    const meta = await getRequestMeta();
    const result = await run(
      parsed.data,
      {
        userId: staff.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        canPublish: hasPermission(staff, 'catalog.publish'),
      },
      staff,
    );
    for (const tag of result.tags) updateTag(tag);
    // A slug change may have created or moved redirects. The request proxy keeps its own short-lived
    // snapshot (15 s) that this cannot reach; clear the one in this module graph as well.
    clearRedirectCache();
    return ok(result.data);
  } catch (error) {
    return toActionError(error);
  }
}

/** Authenticates and checks a permission without doing any work yet (used before reading uploads). */
async function authorize(permission: Permission): Promise<ActionResult<never> | null> {
  try {
    assertPermission(await requireStaff(), permission);
    return null;
  } catch (error) {
    return toActionError(error);
  }
}

/** Reads the one uploaded file of a FormData action, with a size check before buffering it. */
async function readFile(
  form: FormData,
): Promise<{ bytes: Buffer } | { error: ActionResult<never> }> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: fail('VALIDATION', 'Choose an image.', { file: ['Choose an image.'] }) };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      error: fail('VALIDATION', 'The image is larger than 10 MB.', {
        file: ['The image is larger than 10 MB.'],
      }),
    };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // The size the browser reports is not trusted: check what actually arrived.
  if (bytes.length > MAX_IMAGE_BYTES) {
    return {
      error: fail('VALIDATION', 'The image is larger than 10 MB.', {
        file: ['The image is larger than 10 MB.'],
      }),
    };
  }
  return { bytes };
}

const field = (form: FormData, name: string): string | null => {
  const value = form.get(name);
  return typeof value === 'string' ? value : null;
};

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

export async function createCategory(input: unknown) {
  return mutate(input, createCategorySchema, 'catalog.write', (data, actor) =>
    catalog.createCategory(actor, data),
  );
}

export async function updateCategory(input: unknown) {
  return mutate(input, updateCategorySchema, 'catalog.write', (data, actor) =>
    catalog.updateCategory(actor, data),
  );
}

export async function reorderCategories(input: unknown) {
  return mutate(input, reorderCategoriesSchema, 'catalog.write', (data, actor) =>
    catalog.reorderCategories(actor, data),
  );
}

export async function deleteCategory(input: unknown) {
  return mutate(input, deleteCategorySchema, 'catalog.write', (data, actor) =>
    catalog.deleteCategory(actor, data.id),
  );
}

export async function uploadCategoryImage(form: FormData) {
  const parsed = uploadCategoryImageFieldsSchema.safeParse({
    categoryId: field(form, 'categoryId'),
    alt: field(form, 'alt'),
  });
  if (!parsed.success) return validationError(parsed.error);
  const denied = await authorize('catalog.write');
  if (denied) return denied;
  const file = await readFile(form);
  if ('error' in file) return file.error;
  return mutate(parsed.data, uploadCategoryImageFieldsSchema, 'catalog.write', (data, actor) =>
    catalog.setCategoryImage(actor, {
      categoryId: data.categoryId,
      alt: data.alt,
      bytes: file.bytes,
    }),
  );
}

export async function removeCategoryImage(input: unknown) {
  return mutate(input, removeCategoryImageSchema, 'catalog.write', (data, actor) =>
    catalog.removeCategoryImage(actor, data.categoryId),
  );
}

// ---------------------------------------------------------------------------------------------
// Products and variants
// ---------------------------------------------------------------------------------------------

export async function createProduct(input: unknown) {
  return mutate(input, createProductSchema, 'catalog.write', (data, actor) =>
    catalog.createProduct(actor, data),
  );
}

export async function updateProductDetails(input: unknown) {
  return mutate(input, productDetailsSchema, 'catalog.write', (data, actor) =>
    catalog.updateProductDetails(actor, data),
  );
}

/** Going live, archiving or reverting to draft changes what shoppers see: catalog.publish. */
export async function setProductStatus(input: unknown) {
  return mutate(input, productStatusSchema, 'catalog.publish', (data, actor) =>
    catalog.setProductStatus(actor, data),
  );
}

export async function generateVariants(input: unknown) {
  return mutate(input, generateVariantsSchema, 'catalog.write', (data, actor) =>
    catalog.generateVariants(actor, data),
  );
}

export async function updateVariants(input: unknown) {
  return mutate(input, updateVariantsSchema, 'catalog.write', (data, actor) =>
    catalog.updateVariants(actor, data),
  );
}

// ---------------------------------------------------------------------------------------------
// Product media
// ---------------------------------------------------------------------------------------------

/** One image per call (the browser sends several files one after another and shows progress). */
export async function uploadProductMedia(form: FormData) {
  const parsed = uploadMediaFieldsSchema.safeParse({
    productId: field(form, 'productId'),
    alt: field(form, 'alt'),
    optionValueId: field(form, 'optionValueId') || null,
  });
  if (!parsed.success) return validationError(parsed.error);
  const denied = await authorize('catalog.write');
  if (denied) return denied;
  const file = await readFile(form);
  if ('error' in file) return file.error;
  return mutate(parsed.data, uploadMediaFieldsSchema, 'catalog.write', (data, actor) =>
    catalog.uploadProductMedia(actor, { ...data, bytes: file.bytes }),
  );
}

export async function updateProductMedia(input: unknown) {
  return mutate(input, updateMediaSchema, 'catalog.write', (data, actor) =>
    catalog.updateProductMedia(actor, data),
  );
}

export async function reorderProductMedia(input: unknown) {
  return mutate(input, reorderMediaSchema, 'catalog.write', (data, actor) =>
    catalog.reorderProductMedia(actor, data),
  );
}

export async function deleteProductMedia(input: unknown) {
  return mutate(input, deleteMediaSchema, 'catalog.write', (data, actor) =>
    catalog.deleteProductMedia(actor, data.id),
  );
}

// ---------------------------------------------------------------------------------------------
// Size charts
// ---------------------------------------------------------------------------------------------

export async function createSizeChart(input: unknown) {
  return mutate(input, createSizeChartSchema, 'catalog.write', (data, actor) =>
    catalog.createSizeChart(actor, data),
  );
}

export async function updateSizeChart(input: unknown) {
  return mutate(input, updateSizeChartSchema, 'catalog.write', (data, actor) =>
    catalog.updateSizeChart(actor, data),
  );
}

export async function deleteSizeChart(input: unknown) {
  return mutate(input, deleteSizeChartSchema, 'catalog.write', (data, actor) =>
    catalog.deleteSizeChart(actor, data.id),
  );
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

/** Setting a publish date (live or scheduled) also needs catalog.publish. */
const publishNeeded = (data: { publishedAt: string | null }): Permission | null =>
  data.publishedAt === null ? null : 'catalog.publish';

export async function createCollection(input: unknown) {
  return mutate(
    input,
    createCollectionSchema,
    'catalog.write',
    (data, actor) => catalog.createCollection(actor, data),
    publishNeeded,
  );
}

export async function updateCollection(input: unknown) {
  // Publishing rights are decided in the service from the stored state (see updateCollection).
  return mutate(input, updateCollectionSchema, 'catalog.write', (data, actor) =>
    catalog.updateCollection(actor, data),
  );
}

export async function deleteCollection(input: unknown) {
  return mutate(input, deleteCollectionSchema, 'catalog.publish', (data, actor) =>
    catalog.deleteCollection(actor, data.id),
  );
}

export async function refreshCollection(input: unknown) {
  return mutate(input, refreshCollectionSchema, 'catalog.write', (data, actor) =>
    catalog.refreshCollection(actor, data.id),
  );
}

export async function addCollectionProducts(input: unknown) {
  return mutate(input, addCollectionProductsSchema, 'catalog.write', (data, actor) =>
    catalog.addCollectionProducts(actor, data),
  );
}

export async function removeCollectionProduct(input: unknown) {
  return mutate(input, removeCollectionProductSchema, 'catalog.write', (data, actor) =>
    catalog.removeCollectionProduct(actor, data),
  );
}

export async function reorderCollectionProducts(input: unknown) {
  return mutate(input, reorderCollectionProductsSchema, 'catalog.write', (data, actor) =>
    catalog.reorderCollectionProducts(actor, data),
  );
}

export async function uploadCollectionHero(form: FormData) {
  const parsed = uploadCollectionHeroFieldsSchema.safeParse({
    collectionId: field(form, 'collectionId'),
    alt: field(form, 'alt'),
  });
  if (!parsed.success) return validationError(parsed.error);
  const denied = await authorize('catalog.write');
  if (denied) return denied;
  const file = await readFile(form);
  if ('error' in file) return file.error;
  return mutate(parsed.data, uploadCollectionHeroFieldsSchema, 'catalog.write', (data, actor) =>
    catalog.setCollectionHero(actor, {
      collectionId: data.collectionId,
      alt: data.alt,
      bytes: file.bytes,
    }),
  );
}

export async function removeCollectionHero(input: unknown) {
  return mutate(input, removeCollectionHeroSchema, 'catalog.write', (data, actor) =>
    catalog.removeCollectionHero(actor, data.collectionId),
  );
}

/** Live count and a few titles for the rules being edited (nothing is saved). */
export async function previewCollectionRules(
  input: unknown,
): Promise<ActionResult<{ count: number; sample: string[] }>> {
  const parsed = previewRulesSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'catalog.read');
    return ok(await catalog.previewRules(parsed.data.rules));
  } catch (error) {
    return toActionError(error);
  }
}

/** Product search for the "add products" picker of a manual collection. */
export async function searchProductsForPicker(
  input: unknown,
): Promise<
  ActionResult<Array<{ id: string; title: string; status: string; imageUrl: string | null }>>
> {
  const parsed = searchPickerSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'catalog.read');
    return ok(await catalog.searchProductsForPicker(parsed.data.q, parsed.data.excludeIds));
  } catch (error) {
    return toActionError(error);
  }
}
