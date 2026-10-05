import { Prisma } from '@/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import { DomainError, type FieldErrors } from '@/lib/errors';
import { fromDecimalString } from '@/lib/money';
import { getMediaProvider, newMediaKey, processImage, validateUpload } from '@/lib/media';
import { audit } from '@/modules/audit/service';
import { EMPTY_RULES, type CollectionRules } from './collection-rules';
import { MAX_VARIANTS, dedupeSku, planMatrix, skuFor, type MatrixOption } from './matrix';
import * as repo from './repository';
import {
  MAX_MEDIA_PER_PRODUCT,
  type CollectionInput,
  type CreateCategoryInput,
  type GenerateVariantsInput,
  type ProductDetailsInput,
  type SizeChartInput,
  type UpdateCategoryInput,
  type UpdateCollectionInput,
  type UpdateVariantsInput,
} from './schemas';
import {
  categoryPath,
  collectionPath,
  isValidSlug,
  productPath,
  slugify,
  uniqueSlug,
} from './slug';
import { catalogTags } from './tags';
import { CATALOG_CURRENCY, type Actor, type Mutation, type StoredImage } from './types';

/**
 * Catalogue rules: slugs and redirects, the product status gate, the variant matrix, media,
 * size charts and collections. Every public function runs in one transaction with its audit row
 * (INV-A2) and returns the cache tags the caller must invalidate. Authorisation happens in the
 * action; nothing here trusts the browser.
 */

const MAX_CATEGORY_DEPTH = 3;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

const fieldError = (field: string, message: string): DomainError =>
  new DomainError('VALIDATION', message, { fieldErrors: { [field]: [message] } });

const conflict = (field: string, message: string): DomainError =>
  new DomainError('CONFLICT', message, { fieldErrors: { [field]: [message] } });

const notFound = (what: string): DomainError => new DomainError('NOT_FOUND', `${what} not found`);

const auditBase = (actor: Actor) => ({
  actorId: actor.userId,
  ip: actor.ip ?? null,
  userAgent: actor.userAgent ?? null,
});

/** 100 million BDT in minor units: far above any real price, far below the BIGINT limit. */
const MAX_PRICE_MINOR = 10_000_000_000n;

function parseMoney(text: string, field: string): bigint {
  let minor: bigint;
  try {
    minor = fromDecimalString(text, CATALOG_CURRENCY).minor;
  } catch {
    throw fieldError(field, 'Enter a valid amount');
  }
  if (minor > MAX_PRICE_MINOR) throw fieldError(field, 'That amount is too large');
  return minor;
}

// ---------------------------------------------------------------------------------------------
// Slug redirects
// ---------------------------------------------------------------------------------------------

/**
 * A published page moved from `from` to `to`: visitors, links and search engines get a 301.
 * Chains stay one hop (anything that pointed at `from` now points at `to`) and moving back to an
 * earlier address removes the redirect that would loop.
 */
export async function recordRedirect(tx: Tx, from: string, to: string): Promise<void> {
  if (from === to) return;
  await repo.deleteRedirectFrom(tx, to);
  await repo.repointRedirects(tx, from, to);
  await repo.upsertRedirect(tx, from, to);
}

/** A new page at `path` must not be shadowed by an old redirect from the same address. */
export async function reclaimPath(tx: Tx, path: string): Promise<void> {
  await repo.deleteRedirectFrom(tx, path);
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

function categoryDepth(path: string): number {
  return path.split('/').length;
}

const categorySnapshot = (c: {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  isActive: boolean;
  image: string | null;
  position: number;
}) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  path: c.path,
  parentId: c.parentId,
  isActive: c.isActive,
  image: c.image,
  position: c.position,
});

export async function createCategory(
  actor: Actor,
  input: CreateCategoryInput,
): Promise<Mutation<{ id: string; path: string }>> {
  return db.$transaction(async (tx) => {
    const parent = input.parentId ? await repo.findCategory(tx, input.parentId) : null;
    if (input.parentId && !parent) throw fieldError('parentId', 'Parent category not found');
    const slug = input.slug ?? (slugify(input.name) || 'category');
    if (!isValidSlug(slug)) throw fieldError('slug', 'Use lowercase letters, numbers and hyphens');
    const path = parent ? `${parent.path}/${slug}` : slug;
    if (categoryDepth(path) > MAX_CATEGORY_DEPTH) {
      throw fieldError('parentId', `Categories can be nested ${MAX_CATEGORY_DEPTH} levels deep`);
    }
    if (await repo.findCategorySibling(tx, input.parentId, slug)) {
      throw conflict('slug', 'Another category here already uses this slug');
    }
    const position = (await repo.maxCategoryPosition(tx, input.parentId)) + 1;
    const created = await repo.createCategory(tx, {
      parentId: input.parentId,
      name: input.name,
      slug,
      path,
      description: input.description,
      isActive: input.isActive,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      position,
    });
    if (created.isActive) await reclaimPath(tx, categoryPath(path));
    await audit(tx, {
      ...auditBase(actor),
      action: 'category.create',
      entity: 'category',
      entityId: created.id,
      after: categorySnapshot(created),
    });
    return {
      data: { id: created.id, path },
      tags: catalogTags({ categories: [created.id, ...(parent ? [parent.id] : [])] }),
    };
  });
}

export async function updateCategory(
  actor: Actor,
  input: UpdateCategoryInput,
): Promise<Mutation<{ id: string; path: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findCategory(tx, input.id);
    if (!before) throw notFound('Category');
    const parent = input.parentId ? await repo.findCategory(tx, input.parentId) : null;
    if (input.parentId && !parent) throw fieldError('parentId', 'Parent category not found');
    if (parent && (parent.id === before.id || parent.path.startsWith(`${before.path}/`))) {
      throw fieldError('parentId', 'A category cannot sit inside itself');
    }
    const slug = input.slug ?? before.slug;
    const path = parent ? `${parent.path}/${slug}` : slug;
    const descendants = await repo.listCategoryDescendants(tx, before.path);
    const deepest = Math.max(
      categoryDepth(path),
      ...descendants.map((d) => categoryDepth(path + d.path.slice(before.path.length))),
    );
    if (deepest > MAX_CATEGORY_DEPTH) {
      throw fieldError('parentId', `Categories can be nested ${MAX_CATEGORY_DEPTH} levels deep`);
    }
    const sibling = await repo.findCategorySibling(tx, input.parentId, slug);
    if (sibling && sibling.id !== before.id) {
      throw conflict('slug', 'Another category here already uses this slug');
    }
    const movedParent = input.parentId !== before.parentId;
    const after = await repo.updateCategory(tx, before.id, {
      parentId: input.parentId,
      name: input.name,
      slug,
      path,
      description: input.description,
      isActive: input.isActive,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ...(movedParent
        ? { position: (await repo.maxCategoryPosition(tx, input.parentId)) + 1 }
        : {}),
    });

    const touched = [before.id];
    if (path !== before.path) {
      if (before.isActive) await recordRedirect(tx, categoryPath(before.path), categoryPath(path));
      for (const child of descendants) {
        const newPath = path + child.path.slice(before.path.length);
        await repo.updateCategory(tx, child.id, { path: newPath });
        if (child.isActive) {
          await recordRedirect(tx, categoryPath(child.path), categoryPath(newPath));
          await reclaimPath(tx, categoryPath(newPath));
        }
        touched.push(child.id);
      }
    }
    // A live page takes its address back from any old redirect (also when it just became active).
    if (after.isActive) await reclaimPath(tx, categoryPath(after.path));
    await audit(tx, {
      ...auditBase(actor),
      action: 'category.update',
      entity: 'category',
      entityId: before.id,
      before: categorySnapshot(before),
      after: categorySnapshot(after),
    });
    const affected = [
      ...touched,
      ...(before.parentId ? [before.parentId] : []),
      ...(parent ? [parent.id] : []),
    ];
    return { data: { id: after.id, path }, tags: catalogTags({ categories: affected }) };
  });
}

export async function reorderCategories(
  actor: Actor,
  input: { parentId: string | null; orderedIds: string[] },
): Promise<Mutation<{ count: number }>> {
  return db.$transaction(async (tx) => {
    const siblings = await repo.listCategoryIdsBySiblingParent(tx, input.parentId);
    const current = new Set(siblings.map((s) => s.id));
    if (
      input.orderedIds.length !== current.size ||
      !input.orderedIds.every((id) => current.has(id))
    ) {
      throw new DomainError('VALIDATION', 'The list changed. Reload and try again.');
    }
    await repo.setCategoryPositions(tx, input.orderedIds);
    await audit(tx, {
      ...auditBase(actor),
      action: 'category.reorder',
      entity: 'category',
      entityId: input.parentId ?? 'root',
      after: { orderedIds: input.orderedIds },
    });
    return {
      data: { count: input.orderedIds.length },
      tags: catalogTags({ categories: input.orderedIds }),
    };
  });
}

export async function deleteCategory(actor: Actor, id: string): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findCategory(tx, id);
    if (!before) throw notFound('Category');
    const dependents = await repo.countCategoryDependents(tx, id);
    if (dependents.children > 0) {
      throw new DomainError('CONFLICT', 'Move or delete the sub-categories first.');
    }
    if (dependents.products > 0) {
      throw new DomainError(
        'CONFLICT',
        `${dependents.products} product${dependents.products === 1 ? ' uses' : 's use'} this category. Move them first.`,
      );
    }
    await repo.deleteCategory(tx, id);
    await repo.deleteRedirectsTo(tx, categoryPath(before.path));
    await audit(tx, {
      ...auditBase(actor),
      action: 'category.delete',
      entity: 'category',
      entityId: id,
      before: categorySnapshot(before),
    });
    return {
      data: { id },
      tags: catalogTags({ categories: [id, ...(before.parentId ? [before.parentId] : [])] }),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Images (MediaProvider): shared by categories, collections and products
// ---------------------------------------------------------------------------------------------

interface PreparedImage {
  stored: StoredImage;
  dominantColor: string;
  blurData: string;
}

/**
 * The only way an image enters the system: validate by magic bytes and size, re-encode (strips
 * EXIF and GPS), store under a random key through the MediaProvider. The caller removes the object
 * again with discardImage if the database write fails.
 */
async function prepareImage(bytes: Buffer, scope: string, alt: string): Promise<PreparedImage> {
  const check = validateUpload(bytes, { kind: 'image', maxBytes: MAX_MEDIA_BYTES });
  if (!check.ok) throw fieldError('file', check.message);
  let processed;
  try {
    processed = await processImage(bytes);
  } catch {
    throw fieldError('file', 'That image could not be read. Try another file.');
  }
  const provider = getMediaProvider();
  const stored = await provider.put({
    key: newMediaKey(scope, processed.extension),
    body: processed.body,
    contentType: processed.mime,
  });
  return {
    dominantColor: processed.dominantColor,
    blurData: processed.blurData,
    stored: {
      url: stored.url,
      alt,
      provider: stored.provider,
      storageKey: stored.key,
      contentType: stored.contentType,
      sizeBytes: stored.size,
      width: processed.width,
      height: processed.height,
    },
  };
}

/** Removes a stored object, never failing the request (an orphan is cleaned up later). */
async function discardImage(storageKey: string | null | undefined, provider?: string | null) {
  if (!storageKey || provider === 'static') return;
  try {
    await getMediaProvider().delete(storageKey);
  } catch {
    // best effort: a leftover file costs storage, not correctness
  }
}

export async function setCategoryImage(
  actor: Actor,
  input: { categoryId: string; alt: string; bytes: Buffer },
): Promise<Mutation<{ url: string }>> {
  const image = await prepareImage(input.bytes, 'categories', input.alt);
  let oldKey: string | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      const before = await repo.findCategory(tx, input.categoryId);
      if (!before) throw notFound('Category');
      oldKey = storageKeyOf(before.image);
      await repo.updateCategory(tx, before.id, { image: image.stored.url, imageAlt: input.alt });
      await audit(tx, {
        ...auditBase(actor),
        action: 'category.image_set',
        entity: 'category',
        entityId: before.id,
        before: { image: before.image },
        after: { image: image.stored.url, alt: input.alt },
      });
      return { data: { url: image.stored.url }, tags: catalogTags({ categories: [before.id] }) };
    });
    await discardImage(oldKey);
    return result;
  } catch (error) {
    await discardImage(image.stored.storageKey);
    throw error;
  }
}

export async function removeCategoryImage(
  actor: Actor,
  categoryId: string,
): Promise<Mutation<{ id: string }>> {
  let oldKey: string | null = null;
  const result = await db.$transaction(async (tx) => {
    const before = await repo.findCategory(tx, categoryId);
    if (!before) throw notFound('Category');
    oldKey = storageKeyOf(before.image);
    await repo.updateCategory(tx, before.id, { image: null, imageAlt: null });
    await audit(tx, {
      ...auditBase(actor),
      action: 'category.image_remove',
      entity: 'category',
      entityId: before.id,
      before: { image: before.image },
    });
    return { data: { id: before.id }, tags: catalogTags({ categories: [before.id] }) };
  });
  await discardImage(oldKey);
  return result;
}

/** Storage key of an uploaded image from its public URL; static placeholders have none. */
function storageKeyOf(url: string | null): string | null {
  if (!url) return null;
  const match =
    /\/((?:categories|collections|products)\/[A-Za-z0-9_-]{20,64}\.(?:jpg|png|webp|avif))$/.exec(
      url,
    );
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------

const productSnapshot = (p: {
  id: string;
  title: string;
  slug: string;
  status: string;
  categoryId: string | null;
  sizeChartId: string | null;
  fit: string | null;
  tags: string[];
  publishedAt: Date | null;
}) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  status: p.status,
  categoryId: p.categoryId,
  sizeChartId: p.sizeChartId,
  fit: p.fit,
  tags: p.tags,
  publishedAt: p.publishedAt,
});

async function assertCategory(tx: Tx, categoryId: string | null): Promise<void> {
  if (categoryId && !(await repo.findCategory(tx, categoryId))) {
    throw fieldError('categoryId', 'Category not found');
  }
}

export async function createProduct(
  actor: Actor,
  input: { title: string; categoryId: string | null; productType: string | null },
): Promise<Mutation<{ id: string; slug: string }>> {
  return db.$transaction(async (tx) => {
    await assertCategory(tx, input.categoryId);
    const slug = await uniqueSlug(input.title, async (candidate) =>
      Boolean(await repo.findProductBySlug(tx, candidate)),
    );
    const created = await repo.createProduct(tx, {
      title: input.title,
      slug,
      categoryId: input.categoryId,
      productType: input.productType,
      status: 'draft',
    });
    await audit(tx, {
      ...auditBase(actor),
      action: 'product.create',
      entity: 'product',
      entityId: created.id,
      after: productSnapshot(created),
    });
    return { data: { id: created.id, slug }, tags: catalogTags({ products: [created.id] }) };
  });
}

export async function updateProductDetails(
  actor: Actor,
  input: ProductDetailsInput,
): Promise<Mutation<{ id: string; slug: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findProductForUpdate(tx, input.id);
    if (!before) throw notFound('Product');
    await assertCategory(tx, input.categoryId);
    if (input.sizeChartId && !(await repo.findSizeChart(tx, input.sizeChartId))) {
      throw fieldError('sizeChartId', 'Size chart not found');
    }
    if (input.slug !== before.slug) {
      const taken = await repo.findProductBySlug(tx, input.slug);
      if (taken && taken.id !== before.id) throw conflict('slug', 'Another product uses this slug');
    }
    const after = await repo.updateProduct(tx, before.id, {
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      slug: input.slug,
      categoryId: input.categoryId,
      sizeChartId: input.sizeChartId,
      productType: input.productType,
      material: input.material,
      careInstructions: input.careInstructions,
      fit: input.fit,
      origin: input.origin,
      tags: input.tags,
      attributes: stripNulls(input.attributes),
      featuredRank: input.featuredRank,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    });
    if (after.slug !== before.slug) {
      // An address that was ever public (the product may be archived or back in draft now) keeps
      // working; a product that never went live can be renamed freely.
      if (before.publishedAt) {
        await recordRedirect(tx, productPath(before.slug), productPath(after.slug));
      }
      // Only a live page takes its address back from an old redirect; a draft does so when it goes live.
      if (after.status === 'active') await reclaimPath(tx, productPath(after.slug));
    }
    if (before.status === 'active' && !after.categoryId) {
      throw fieldError('categoryId', 'A live product needs a category.');
    }
    // Rules only match live products, so a draft or archived edit cannot change any collection.
    const collections = after.status === 'active' ? await rebuildAutomaticCollections(tx) : [];
    await audit(tx, {
      ...auditBase(actor),
      action: 'product.update',
      entity: 'product',
      entityId: before.id,
      before: productSnapshot(before),
      after: productSnapshot(after),
    });
    return {
      data: { id: after.id, slug: after.slug },
      tags: catalogTags({
        products: [after.id],
        collections,
        categories: [before.categoryId, after.categoryId].filter((v): v is string => Boolean(v)),
      }),
    };
  });
}

function stripNulls(values: Record<string, string | null>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== null),
  ) as Prisma.InputJsonObject;
}

export async function setProductStatus(
  actor: Actor,
  input: { id: string; status: 'draft' | 'active' | 'archived' },
): Promise<Mutation<{ id: string; status: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findProductForUpdate(tx, input.id);
    if (!before) throw notFound('Product');
    if (before.status === input.status) {
      return { data: { id: before.id, status: before.status }, tags: [] };
    }
    if (input.status === 'active') {
      const ready = await repo.productReadiness(tx, before.id);
      const problems: string[] = [];
      if (ready.activeVariants === 0) problems.push('Add at least one active variant.');
      else if (ready.pricedVariants < ready.activeVariants)
        problems.push('Every active variant needs a price above zero.');
      if (ready.images === 0) problems.push('Add at least one image.');
      if (!ready.hasCategory) problems.push('Choose a category.');
      if (problems.length > 0) {
        throw new DomainError('VALIDATION', problems.join(' '), {
          fieldErrors: { status: problems },
        });
      }
    }
    const after = await repo.updateProduct(tx, before.id, {
      status: input.status,
      ...(input.status === 'active' && !before.publishedAt ? { publishedAt: new Date() } : {}),
    });
    if (input.status === 'active') await reclaimPath(tx, productPath(after.slug));
    const collections =
      before.status === 'active' || after.status === 'active'
        ? await rebuildAutomaticCollections(tx)
        : [];
    await audit(tx, {
      ...auditBase(actor),
      action: 'product.status_change',
      entity: 'product',
      entityId: before.id,
      before: { status: before.status },
      after: { status: after.status, publishedAt: after.publishedAt },
    });
    return {
      data: { id: after.id, status: after.status },
      tags: catalogTags({
        products: [after.id],
        collections,
        categories: after.categoryId ? [after.categoryId] : [],
      }),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Options and variants
// ---------------------------------------------------------------------------------------------

/** A live product must keep at least one active variant and every active variant a price. */
async function assertSellable(tx: Tx, productId: string): Promise<void> {
  const ready = await repo.productReadiness(tx, productId);
  if (ready.activeVariants === 0 || ready.pricedVariants < ready.activeVariants) {
    throw new DomainError(
      'VALIDATION',
      'A live product needs at least one active, priced variant. Archive the product instead.',
    );
  }
}

export async function generateVariants(
  actor: Actor,
  input: GenerateVariantsInput,
): Promise<Mutation<{ created: number; removed: number; archived: number; total: number }>> {
  const price = parseMoney(input.defaults.price, 'defaults.price');
  const compareAt = input.defaults.compareAt
    ? parseMoney(input.defaults.compareAt, 'defaults.compareAt')
    : null;
  if (price <= 0n) throw fieldError('defaults.price', 'The price must be above zero');
  if (compareAt !== null && compareAt <= price) {
    throw fieldError('defaults.compareAt', 'The compare-at price must be higher than the price');
  }

  const requested = input.options.map((option, optionIndex) => {
    const seen = new Set<string>();
    const values = option.values.map((v, valueIndex) => {
      const slug = slugify(v.label);
      const path = `options.${optionIndex}.values.${valueIndex}.label`;
      if (!slug) throw fieldError(path, 'Use letters or numbers');
      if (seen.has(slug)) throw fieldError(path, 'Values must be different');
      seen.add(slug);
      return { id: v.id ?? null, slug, label: v.label, swatchHex: v.swatchHex };
    });
    return { id: option.id ?? null, name: option.name, values };
  });
  const names = requested.map((o) => o.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    throw fieldError('options', 'Option names must be different');
  }
  const total = requested.reduce((n, o) => n * o.values.length, requested.length > 0 ? 1 : 0);
  if (total > MAX_VARIANTS) {
    throw fieldError('options', `That makes ${total} variants. The limit is ${MAX_VARIANTS}.`);
  }

  return db.$transaction(async (tx) => {
    const product = await repo.findProductForUpdate(tx, input.productId);
    if (!product) throw notFound('Product');
    const before = await repo.listVariantsWithValues(tx, product.id);
    const beforeOptions = await repo.listOptions(tx, product.id);
    const optionById = new Map(beforeOptions.map((o) => [o.id, o]));
    const valueById = new Map(
      beforeOptions.flatMap((o) => o.values.map((v) => [v.id, v] as const)),
    );

    // 0. Rows that are renamed by id first move to throwaway names, so swapping or shifting names
    // (M to L while L to XL) never collides with a unique index half way through.
    for (const option of requested) {
      if (!option.id || !optionById.has(option.id)) continue;
      await repo.updateOption(
        tx,
        option.id,
        `__tmp:${option.id}`,
        optionById.get(option.id)!.position,
      );
      for (const value of option.values) {
        const current = value.id ? valueById.get(value.id) : undefined;
        if (current && current.optionId === option.id) {
          await repo.updateOptionValue(tx, current.id, {
            value: `__tmp:${current.id}`,
            label: current.label,
            swatchHex: current.swatchHex,
            position: current.position,
          });
        }
      }
    }

    // 1. Options and values. An id keeps the row (and so its variants) through a rename; without
    // an id the option is matched by name and the value by its slug.
    const savedOptions: Array<{ id: string; values: Array<{ id: string; label: string }> }> = [];
    for (const [index, option] of requested.entries()) {
      let optionId: string;
      if (option.id) {
        if (!optionById.has(option.id)) {
          throw fieldError(`options.${index}.name`, 'Option not found');
        }
        optionId = (await repo.updateOption(tx, option.id, option.name, index)).id;
      } else {
        optionId = (await repo.upsertOption(tx, product.id, option.name, index)).id;
      }
      const values: Array<{ id: string; label: string }> = [];
      for (const [valueIndex, value] of option.values.entries()) {
        const data = {
          value: value.slug,
          label: value.label,
          swatchHex: value.swatchHex,
          position: valueIndex,
        };
        let row: { id: string };
        if (value.id) {
          const current = valueById.get(value.id);
          if (!current || current.optionId !== optionId) {
            throw fieldError(`options.${index}.values.${valueIndex}.label`, 'Value not found');
          }
          row = await repo.updateOptionValue(tx, value.id, data);
        } else {
          row = await repo.upsertOptionValue(tx, optionId, data);
        }
        values.push({ id: row.id, label: value.label });
      }
      savedOptions.push({ id: optionId, values });
    }

    // 2. Reconcile variants with the wanted matrix, by option value ids.
    const matrixOptions: MatrixOption[] = requested.map((option, index) => ({
      name: option.name,
      values: savedOptions[index]!.values.map((v) => ({ value: v.id, label: v.label })),
    }));
    const optionOrder = savedOptions.map((o) => o.id);
    const existing = before.map((v) => ({
      id: v.id,
      status: v.status,
      sku: v.sku,
      priceMinor: v.priceMinor,
      referenced: v._count.inventory + v._count.movements > 0,
      hasValues: v.optionValues.length > 0,
      values: optionOrder.map(
        (optionId) =>
          v.optionValues.find((ov) => ov.optionValue.optionId === optionId)?.optionValueId ?? '',
      ),
    }));
    const plan = planMatrix(
      matrixOptions,
      existing.filter((v) => v.values.every(Boolean)),
    );
    const mismatched = existing.filter((v) => !v.values.every(Boolean)).map((v) => v.id);
    const toRemove = [...plan.remove, ...mismatched];

    let removed = 0;
    let archived = 0;
    const removedSkus: string[] = [];
    const archivedSkus: string[] = [];
    const reactivatedSkus: string[] = [];
    for (const id of toRemove) {
      const variant = existing.find((v) => v.id === id)!;
      if (variant.referenced) {
        if (variant.status !== 'archived') {
          await repo.archiveVariant(tx, id);
          archived += 1;
          archivedSkus.push(variant.sku);
        }
      } else {
        await repo.deleteVariant(tx, id);
        removed += 1;
        removedSkus.push(variant.sku);
      }
    }
    for (const id of plan.keep) {
      const variant = existing.find((v) => v.id === id)!;
      // A product without options keeps one default variant that points at no option value.
      if (requested.length === 0 && variant.hasValues) await repo.unlinkVariantValues(tx, id);
      // A combination that comes back reactivates its archived variant, unless it was never priced:
      // a variant without a price must not become sellable by accident.
      if (variant.status === 'archived' && variant.priceMinor > 0n) {
        await repo.updateVariant(tx, id, { status: 'active' });
        reactivatedSkus.push(variant.sku);
      }
    }

    // 3. Create the missing variants with unique SKUs.
    const prefix = input.defaults.skuPrefix || product.title;
    // SKUs are unique across the shop: probe the database for every candidate (base, base-2, ...).
    const used = new Set<string>();
    let position = Math.max(-1, ...before.map((v) => v.position)) + 1;
    const createdSkus: string[] = [];
    for (const combination of plan.create) {
      const base = skuFor(prefix, combination.labels) || `SKU-${position + 1}`;
      let sku = dedupeSku(base, used);
      while ((await repo.existingSkus(tx, [sku])).size > 0) {
        used.add(sku);
        sku = dedupeSku(base, used);
      }
      used.add(sku);
      createdSkus.push(sku);
      const created = await repo.createVariant(tx, {
        productId: product.id,
        sku,
        priceMinor: price,
        compareAtMinor: compareAt,
        currency: CATALOG_CURRENCY,
        weightG: input.defaults.weightG,
        status: 'active',
        position: position++,
      });
      await repo.linkVariantValues(tx, created.id, combination.values);
    }

    // 4. Drop options and values that nothing uses any more (archived variants keep theirs).
    const remaining = await repo.listVariantsWithValues(tx, product.id);
    const inUse = new Set(remaining.flatMap((v) => v.optionValues.map((ov) => ov.optionValueId)));
    for (const saved of savedOptions) {
      await repo.deleteOptionValuesExcept(tx, saved.id, [
        ...saved.values.map((v) => v.id),
        ...inUse,
      ]);
    }
    const stillReferenced = beforeOptions
      .filter((o) => o.values.some((v) => inUse.has(v.id)))
      .map((o) => o.id);
    await repo.deleteOptionsExcept(tx, product.id, [
      ...savedOptions.map((o) => o.id),
      ...stillReferenced,
    ]);
    await repo.setDefaultVariant(tx, product.id);

    const totalNow = await repo.countProductVariants(tx, product.id);
    if (product.status === 'active') await assertSellable(tx, product.id);
    const collections = product.status === 'active' ? await rebuildAutomaticCollections(tx) : [];
    await audit(tx, {
      ...auditBase(actor),
      action: 'product.variants_generate',
      entity: 'product',
      entityId: product.id,
      before: { variants: before.length, options: beforeOptions.map((o) => o.name) },
      after: {
        variants: totalNow,
        created: plan.create.length,
        removed,
        archived,
        options: requested.map((o) => ({ name: o.name, values: o.values.map((v) => v.slug) })),
        defaults: {
          priceMinor: price,
          compareAtMinor: compareAt,
          weightG: input.defaults.weightG,
          skuPrefix: input.defaults.skuPrefix,
        },
        createdSkus,
        removedSkus,
        archivedSkus,
        reactivatedSkus,
      },
    });
    return {
      data: { created: plan.create.length, removed, archived, total: totalNow },
      tags: catalogTags({ products: [product.id], collections }),
    };
  });
}

export async function updateVariants(
  actor: Actor,
  input: UpdateVariantsInput,
): Promise<Mutation<{ updated: number }>> {
  const ids = input.variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length)
    throw new DomainError('VALIDATION', 'Duplicate variant in the request');
  const skus = input.variants.map((v) => v.sku.toLowerCase());
  const errors: FieldErrors = {};
  skus.forEach((sku, i) => {
    if (skus.indexOf(sku) !== i)
      (errors[`variants.${i}.sku`] ??= []).push('SKUs must be different');
  });
  if (Object.keys(errors).length > 0) {
    throw new DomainError('VALIDATION', 'Some SKUs are repeated.', { fieldErrors: errors });
  }

  return db.$transaction(async (tx) => {
    const product = await repo.findProductForUpdate(tx, input.productId);
    if (!product) throw notFound('Product');
    const current = await repo.findVariantsByIds(tx, product.id, ids);
    if (current.length !== ids.length) throw notFound('Variant');
    const byId = new Map(current.map((v) => [v.id, v]));

    const problems: FieldErrors = {};
    const add = (i: number, field: string, message: string) => {
      (problems[`variants.${i}.${field}`] ??= []).push(message);
    };
    const changes: Array<{
      id: string;
      data: Prisma.ProductVariantUncheckedUpdateInput;
      before: unknown;
      after: unknown;
    }> = [];
    for (const [i, row] of input.variants.entries()) {
      const variant = byId.get(row.id)!;
      let price = variant.priceMinor;
      let compareAt = variant.compareAtMinor;
      try {
        price = parseMoney(row.price, 'price');
        compareAt = row.compareAt ? parseMoney(row.compareAt, 'compareAt') : null;
      } catch {
        add(i, 'price', 'Enter a valid amount');
        continue;
      }
      if (row.status === 'active' && price <= 0n)
        add(i, 'price', 'An active variant needs a price above zero');
      if (compareAt !== null && compareAt <= price)
        add(i, 'compareAt', 'Must be higher than the price');
      const data: Prisma.ProductVariantUncheckedUpdateInput = {};
      const fromSnap: Record<string, unknown> = {
        sku: variant.sku,
        barcode: variant.barcode,
        priceMinor: variant.priceMinor,
        compareAtMinor: variant.compareAtMinor,
        weightG: variant.weightG,
        status: variant.status,
      };
      const toSnap: Record<string, unknown> = {
        sku: row.sku,
        barcode: row.barcode,
        priceMinor: price,
        compareAtMinor: compareAt,
        weightG: row.weightG,
        status: row.status,
      };
      if (row.sku !== variant.sku) data.sku = row.sku;
      if (row.barcode !== variant.barcode) data.barcode = row.barcode;
      if (price !== variant.priceMinor) data.priceMinor = price;
      if (compareAt !== variant.compareAtMinor) data.compareAtMinor = compareAt;
      if (row.weightG !== variant.weightG) data.weightG = row.weightG;
      if (row.status !== variant.status) data.status = row.status;
      if (Object.keys(data).length > 0)
        changes.push({ id: row.id, data, before: fromSnap, after: toSnap });
    }
    if (Object.keys(problems).length > 0) {
      throw new DomainError('VALIDATION', 'Please check the highlighted fields.', {
        fieldErrors: problems,
      });
    }

    const changedSkus = changes
      .filter((c) => c.data.sku !== undefined)
      .map((c) => (c.after as { sku: string }).sku);
    if (changedSkus.length > 0) {
      const clash = await repo.existingSkus(tx, changedSkus);
      for (const sku of clash) {
        const index = input.variants.findIndex((v) => v.sku === sku);
        add(index, 'sku', 'This SKU is already used');
      }
      if (Object.keys(problems).length > 0) {
        throw new DomainError('CONFLICT', 'A SKU is already used.', { fieldErrors: problems });
      }
    }

    for (const change of changes) await repo.updateVariant(tx, change.id, change.data);

    if (product.status === 'active') await assertSellable(tx, product.id);
    const collections =
      changes.length > 0 && product.status === 'active'
        ? await rebuildAutomaticCollections(tx)
        : [];
    if (changes.length > 0) {
      await audit(tx, {
        ...auditBase(actor),
        action: 'product.variants_update',
        entity: 'product',
        entityId: product.id,
        before: changes.map((c) => ({ id: c.id, ...(c.before as object) })),
        after: changes.map((c) => ({ id: c.id, ...(c.after as object) })),
      });
    }
    return {
      data: { updated: changes.length },
      tags: changes.length > 0 ? catalogTags({ products: [product.id], collections }) : [],
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Product media
// ---------------------------------------------------------------------------------------------

export async function uploadProductMedia(
  actor: Actor,
  input: { productId: string; alt: string; optionValueId: string | null; bytes: Buffer },
): Promise<Mutation<{ id: string; url: string }>> {
  // Cheap checks before the expensive image work.
  const product = await db.$transaction((tx) => repo.findProduct(tx, input.productId));
  if (!product) throw notFound('Product');
  const image = await prepareImage(input.bytes, 'products', input.alt);
  try {
    return await db.$transaction(async (tx) => {
      // Serialise with other writes to this product (the image cap and positions).
      if (!(await repo.findProductForUpdate(tx, input.productId))) throw notFound('Product');
      const count = await repo.countMedia(tx, input.productId);
      if (count >= MAX_MEDIA_PER_PRODUCT) {
        throw new DomainError('VALIDATION', `A product can have ${MAX_MEDIA_PER_PRODUCT} images.`);
      }
      if (input.optionValueId) {
        const value = await repo.findOptionValue(tx, input.optionValueId);
        if (!value || value.option.productId !== input.productId) {
          throw fieldError('optionValueId', 'That colour does not belong to this product');
        }
      }
      const created = await repo.createMedia(tx, {
        productId: input.productId,
        optionValueId: input.optionValueId,
        type: 'image',
        provider: image.stored.provider,
        storageKey: image.stored.storageKey,
        url: image.stored.url,
        contentType: image.stored.contentType,
        sizeBytes: image.stored.sizeBytes,
        alt: input.alt,
        width: image.stored.width,
        height: image.stored.height,
        dominantColor: image.dominantColor,
        blurData: image.blurData,
        position: count,
      });
      await audit(tx, {
        ...auditBase(actor),
        action: 'media.upload',
        entity: 'product_media',
        entityId: created.id,
        after: {
          productId: input.productId,
          url: created.url,
          alt: created.alt,
          sizeBytes: created.sizeBytes,
        },
      });
      return {
        data: { id: created.id, url: created.url },
        tags: catalogTags({ products: [input.productId] }),
      };
    });
  } catch (error) {
    await discardImage(image.stored.storageKey);
    throw error;
  }
}

export async function updateProductMedia(
  actor: Actor,
  input: { id: string; alt: string; optionValueId: string | null },
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findMedia(tx, input.id);
    if (!before) throw notFound('Image');
    if (input.optionValueId) {
      const value = await repo.findOptionValue(tx, input.optionValueId);
      if (!value || value.option.productId !== before.productId) {
        throw fieldError('optionValueId', 'That colour does not belong to this product');
      }
    }
    await repo.updateMedia(tx, before.id, { alt: input.alt, optionValueId: input.optionValueId });
    await audit(tx, {
      ...auditBase(actor),
      action: 'media.update',
      entity: 'product_media',
      entityId: before.id,
      before: { alt: before.alt, optionValueId: before.optionValueId },
      after: { alt: input.alt, optionValueId: input.optionValueId },
    });
    return { data: { id: before.id }, tags: catalogTags({ products: [before.productId] }) };
  });
}

export async function reorderProductMedia(
  actor: Actor,
  input: { productId: string; orderedIds: string[] },
): Promise<Mutation<{ count: number }>> {
  return db.$transaction(async (tx) => {
    const current = await repo.listMedia(tx, input.productId);
    const ids = new Set(current.map((m) => m.id));
    if (input.orderedIds.length !== ids.size || !input.orderedIds.every((id) => ids.has(id))) {
      throw new DomainError('VALIDATION', 'The images changed. Reload and try again.');
    }
    await repo.setMediaPositions(tx, input.orderedIds);
    await audit(tx, {
      ...auditBase(actor),
      action: 'media.reorder',
      entity: 'product',
      entityId: input.productId,
      before: { orderedIds: current.map((m) => m.id) },
      after: { orderedIds: input.orderedIds },
    });
    return {
      data: { count: input.orderedIds.length },
      tags: catalogTags({ products: [input.productId] }),
    };
  });
}

export async function deleteProductMedia(
  actor: Actor,
  id: string,
): Promise<Mutation<{ id: string }>> {
  let removed: { storageKey: string | null; provider: string } | null = null;
  const result = await db.$transaction(async (tx) => {
    const before = await repo.findMedia(tx, id);
    if (!before) throw notFound('Image');
    const product = await repo.findProductForUpdate(tx, before.productId);
    if (product?.status === 'active' && (await repo.countMedia(tx, before.productId)) <= 1) {
      throw new DomainError(
        'VALIDATION',
        'A live product needs at least one image. Archive the product first.',
      );
    }
    await repo.deleteMedia(tx, before.id);
    const rest = (await repo.listMedia(tx, before.productId)).map((m) => m.id);
    await repo.setMediaPositions(tx, rest);
    await audit(tx, {
      ...auditBase(actor),
      action: 'media.delete',
      entity: 'product_media',
      entityId: before.id,
      before: { productId: before.productId, url: before.url, alt: before.alt },
    });
    removed = { storageKey: before.storageKey, provider: before.provider };
    return { data: { id: before.id }, tags: catalogTags({ products: [before.productId] }) };
  });
  const gone = removed as { storageKey: string | null; provider: string } | null;
  if (gone) await discardImage(gone.storageKey, gone.provider);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Size charts
// ---------------------------------------------------------------------------------------------

const chartTable = (input: SizeChartInput) => ({ columns: input.columns, rows: input.rows });

export async function createSizeChart(
  actor: Actor,
  input: SizeChartInput,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const created = await repo.createSizeChart(tx, {
      name: input.name,
      unit: input.unit,
      table: chartTable(input),
      howToMeasure: input.howToMeasure,
      modelInfo: input.modelInfo,
    });
    await audit(tx, {
      ...auditBase(actor),
      action: 'size_chart.create',
      entity: 'size_chart',
      entityId: created.id,
      after: { name: created.name, unit: created.unit, table: created.table },
    });
    return { data: { id: created.id }, tags: [] };
  });
}

export async function updateSizeChart(
  actor: Actor,
  input: SizeChartInput & { id: string },
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findSizeChart(tx, input.id);
    if (!before) throw notFound('Size chart');
    const after = await repo.updateSizeChart(tx, before.id, {
      name: input.name,
      unit: input.unit,
      table: chartTable(input),
      howToMeasure: input.howToMeasure,
      modelInfo: input.modelInfo,
    });
    await audit(tx, {
      ...auditBase(actor),
      action: 'size_chart.update',
      entity: 'size_chart',
      entityId: before.id,
      before: { name: before.name, unit: before.unit, table: before.table },
      after: { name: after.name, unit: after.unit, table: after.table },
    });
    // Product pages show the chart: every product that uses it must refresh.
    const products = await tx.product.findMany({
      where: { sizeChartId: before.id },
      select: { id: true },
    });
    return { data: { id: before.id }, tags: catalogTags({ products: products.map((p) => p.id) }) };
  });
}

export async function deleteSizeChart(
  actor: Actor,
  id: string,
): Promise<Mutation<{ id: string; detached: number }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findSizeChart(tx, id);
    if (!before) throw notFound('Size chart');
    const products = await tx.product.findMany({
      where: { sizeChartId: id },
      select: { id: true },
    });
    await repo.deleteSizeChart(tx, id);
    await audit(tx, {
      ...auditBase(actor),
      action: 'size_chart.delete',
      entity: 'size_chart',
      entityId: id,
      before: { name: before.name, products: products.length },
    });
    return {
      data: { id, detached: products.length },
      tags: catalogTags({ products: products.map((p) => p.id) }),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

const toRules = (value: unknown): CollectionRules => {
  const rules = value as Partial<CollectionRules> | null;
  return rules && Array.isArray(rules.conditions)
    ? { match: rules.match === 'any' ? 'any' : 'all', conditions: rules.conditions }
    : EMPTY_RULES;
};

const priceToMinor = (decimal: string): bigint => parseMoney(decimal, 'rules');

type Matched = Awaited<ReturnType<typeof repo.matchProducts>>[number];

const lowestPrice = (p: Matched): bigint =>
  p.variants.length === 0
    ? 0n
    : p.variants.reduce(
        (min, v) => (v.priceMinor < min ? v.priceMinor : min),
        p.variants[0]!.priceMinor,
      );

/**
 * Members of an automatic collection in the order it shows them. "Best selling" has no sales data
 * yet and falls back to newest; "manual" keeps the featured rank, then newest.
 */
function sortMatches(matches: Matched[], sortOrder: string): Matched[] {
  const newest = (a: Matched, b: Matched) =>
    (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || (a.id < b.id ? 1 : -1);
  const copy = [...matches];
  switch (sortOrder) {
    case 'price_asc':
      return copy.sort((a, b) => Number(lowestPrice(a) - lowestPrice(b)) || newest(a, b));
    case 'price_desc':
      return copy.sort((a, b) => Number(lowestPrice(b) - lowestPrice(a)) || newest(a, b));
    case 'newest':
    case 'best_selling':
      return copy.sort(newest);
    default:
      return copy.sort(
        (a, b) =>
          (a.featuredRank ?? Number.MAX_SAFE_INTEGER) -
            (b.featuredRank ?? Number.MAX_SAFE_INTEGER) || newest(a, b),
      );
  }
}

/** Products matching the rules, in the order the collection would show them (first MATCH_LIMIT). */
async function matchRules(tx: Tx, rules: CollectionRules, sortOrder: string) {
  return sortMatches(
    await repo.matchProducts(tx, repo.rulesToWhere(rules, priceToMinor)),
    sortOrder,
  );
}

/** Product search for the "add products" picker (title, slug or SKU), excluding current members. */
export async function searchProductsForPicker(
  q: string,
  excludeIds: readonly string[],
): Promise<Array<{ id: string; title: string; status: string; imageUrl: string | null }>> {
  const rows = await db.$transaction((tx) =>
    repo.searchProductsForPicker(tx, q.trim(), excludeIds),
  );
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    imageUrl: p.media[0]?.url ?? null,
  }));
}

export async function previewRules(
  rules: CollectionRules,
): Promise<{ count: number; sample: string[]; capped: boolean }> {
  return db.$transaction(async (tx) => {
    const where = repo.rulesToWhere(rules, priceToMinor);
    const [count, rows] = await Promise.all([
      repo.countProducts(tx, where),
      repo.matchProducts(tx, where, 12),
    ]);
    return { count, sample: rows.map((r) => r.title), capped: count > repo.MATCH_LIMIT };
  });
}

/**
 * Re-evaluates every automatic collection and rewrites the ones whose members changed. Called
 * from product writes so a collection never lists a product that stopped matching. Returns the
 * ids of collections that changed (for cache tags).
 */
export async function rebuildAutomaticCollections(
  tx: Tx,
  only?: readonly string[],
): Promise<string[]> {
  // Ids in a fixed order so two writers always take the locks in the same order.
  const listed = (await repo.listAutomaticCollections(tx))
    .filter((c) => !only || only.includes(c.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const changed: string[] = [];
  for (const listedCollection of listed) {
    // One rebuild of a collection at a time: two product saves must not both rewrite its members.
    await repo.lockCollection(tx, listedCollection.id);
    // Rules may have changed while this writer waited for the lock: read them again.
    const collection = await repo.findCollection(tx, listedCollection.id);
    if (!collection || collection.type !== 'automatic') continue;
    const matches = await matchRules(tx, toRules(collection.rules), collection.sortOrder);
    const wanted = matches.map((m) => m.id);
    const current = (await repo.listCollectionProducts(tx, collection.id)).map((m) => m.productId);
    if (wanted.length === current.length && wanted.every((id, i) => id === current[i])) continue;
    await repo.replaceCollectionProducts(tx, collection.id, wanted);
    changed.push(collection.id);
  }
  return changed;
}

const collectionSnapshot = (c: {
  id: string;
  slug: string;
  title: string;
  type: string;
  sortOrder: string;
  publishedAt: Date | null;
  isFeatured: boolean;
  rules: unknown;
}) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  type: c.type,
  sortOrder: c.sortOrder,
  publishedAt: c.publishedAt,
  isFeatured: c.isFeatured,
  rules: c.rules,
});

const isLive = (publishedAt: Date | null, now = new Date()): boolean =>
  publishedAt !== null && publishedAt.getTime() <= now.getTime();

export async function createCollection(
  actor: Actor,
  input: CollectionInput,
): Promise<Mutation<{ id: string; slug: string }>> {
  return db.$transaction(async (tx) => {
    const slug =
      input.slug ??
      (await uniqueSlug(input.title, async (c) => Boolean(await repo.findCollectionBySlug(tx, c))));
    if (input.slug && (await repo.findCollectionBySlug(tx, slug))) {
      throw conflict('slug', 'Another collection uses this slug');
    }
    if (input.publishedAt !== null && !actor.canPublish) {
      throw new DomainError('FORBIDDEN', undefined, {
        cause: new Error('publishing a collection needs catalog.publish'),
      });
    }
    const created = await repo.createCollection(tx, {
      slug,
      title: input.title,
      description: input.description,
      type: input.type,
      rules:
        input.type === 'automatic'
          ? (input.rules as unknown as Prisma.InputJsonObject)
          : ({} as Prisma.InputJsonObject),
      sortOrder: input.sortOrder,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      isFeatured: input.isFeatured,
    });
    if (isLive(created.publishedAt)) await reclaimPath(tx, collectionPath(slug));
    if (created.type === 'automatic') await rebuildAutomaticCollections(tx, [created.id]);
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.create',
      entity: 'collection',
      entityId: created.id,
      after: collectionSnapshot(created),
    });
    return { data: { id: created.id, slug }, tags: catalogTags({ collections: [created.id] }) };
  });
}

export async function updateCollection(
  actor: Actor,
  input: UpdateCollectionInput,
): Promise<Mutation<{ id: string; slug: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findCollection(tx, input.id);
    if (!before) throw notFound('Collection');
    const slug = input.slug ?? before.slug;
    // What shoppers see is a publish decision: changing the publish date (including taking a live
    // collection back to draft) or featuring a live one needs catalog.publish. The check lives here,
    // against the stored state, so it cannot be skipped by how a request is shaped.
    const nextPublishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
    const publishChanged =
      (before.publishedAt?.getTime() ?? null) !== (nextPublishedAt?.getTime() ?? null);
    const featuredChangedOnLive =
      before.isFeatured !== input.isFeatured && isLive(before.publishedAt);
    if ((publishChanged || featuredChangedOnLive) && !actor.canPublish) {
      throw new DomainError('FORBIDDEN', undefined, {
        cause: new Error('changing publication needs catalog.publish'),
      });
    }
    if (slug !== before.slug) {
      const taken = await repo.findCollectionBySlug(tx, slug);
      if (taken && taken.id !== before.id)
        throw conflict('slug', 'Another collection uses this slug');
    }
    // Switching a hand-picked collection to rules replaces its list: keep the old list in the trail.
    const replacedMembers =
      before.type === 'manual' && input.type === 'automatic'
        ? (await repo.listCollectionProducts(tx, before.id)).map((m) => m.productId)
        : null;
    const after = await repo.updateCollection(tx, before.id, {
      slug,
      title: input.title,
      description: input.description,
      type: input.type,
      rules:
        input.type === 'automatic'
          ? (input.rules as unknown as Prisma.InputJsonObject)
          : ({} as Prisma.InputJsonObject),
      sortOrder: input.sortOrder,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      isFeatured: input.isFeatured,
    });
    if (slug !== before.slug) {
      if (isLive(before.publishedAt))
        await recordRedirect(tx, collectionPath(before.slug), collectionPath(slug));
    }
    if (isLive(after.publishedAt)) await reclaimPath(tx, collectionPath(slug));
    // Rules changed or the collection became automatic: members follow the rules from now on.
    if (after.type === 'automatic') await rebuildAutomaticCollections(tx, [after.id]);
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.update',
      entity: 'collection',
      entityId: before.id,
      before: {
        ...collectionSnapshot(before),
        ...(replacedMembers ? { memberIds: replacedMembers } : {}),
      },
      after: collectionSnapshot(after),
    });
    return { data: { id: after.id, slug }, tags: catalogTags({ collections: [after.id] }) };
  });
}

export async function deleteCollection(
  actor: Actor,
  id: string,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findCollection(tx, id);
    if (!before) throw notFound('Collection');
    await repo.deleteCollection(tx, id);
    await repo.deleteRedirectsTo(tx, collectionPath(before.slug));
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.delete',
      entity: 'collection',
      entityId: id,
      before: collectionSnapshot(before),
    });
    return { data: { id }, tags: catalogTags({ collections: [id] }) };
  });
}

export async function refreshCollection(
  actor: Actor,
  id: string,
): Promise<Mutation<{ id: string; count: number }>> {
  return db.$transaction(async (tx) => {
    const collection = await repo.findCollection(tx, id);
    if (!collection) throw notFound('Collection');
    if (collection.type !== 'automatic') {
      throw new DomainError('VALIDATION', 'Only automatic collections follow rules.');
    }
    await rebuildAutomaticCollections(tx, [id]);
    const count = (await repo.listCollectionProducts(tx, id)).length;
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.refresh',
      entity: 'collection',
      entityId: id,
      after: { count },
    });
    return { data: { id, count }, tags: catalogTags({ collections: [id] }) };
  });
}

async function manualCollection(tx: Tx, id: string) {
  const collection = await repo.findCollection(tx, id);
  if (!collection) throw notFound('Collection');
  if (collection.type !== 'manual') {
    throw new DomainError('VALIDATION', 'This collection follows rules. Change its rules instead.');
  }
  return collection;
}

export async function addCollectionProducts(
  actor: Actor,
  input: { collectionId: string; productIds: string[] },
): Promise<Mutation<{ added: number }>> {
  return db.$transaction(async (tx) => {
    await manualCollection(tx, input.collectionId);
    const found = await repo.findProductsByIds(tx, input.productIds);
    if (found.length !== new Set(input.productIds).size) throw notFound('Product');
    const start = (await repo.maxCollectionPosition(tx, input.collectionId)) + 1;
    const unique = [...new Set(input.productIds)];
    const result = await repo.addCollectionProducts(
      tx,
      input.collectionId,
      unique.map((productId, i) => ({ productId, position: start + i })),
    );
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.products_add',
      entity: 'collection',
      entityId: input.collectionId,
      after: { productIds: unique },
    });
    return {
      data: { added: result.count },
      tags: catalogTags({ collections: [input.collectionId], products: unique }),
    };
  });
}

export async function removeCollectionProduct(
  actor: Actor,
  input: { collectionId: string; productId: string },
): Promise<Mutation<{ removed: number }>> {
  return db.$transaction(async (tx) => {
    await manualCollection(tx, input.collectionId);
    const result = await repo.removeCollectionProduct(tx, input.collectionId, input.productId);
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.products_remove',
      entity: 'collection',
      entityId: input.collectionId,
      before: { productId: input.productId },
    });
    return {
      data: { removed: result.count },
      tags: catalogTags({ collections: [input.collectionId], products: [input.productId] }),
    };
  });
}

export async function reorderCollectionProducts(
  actor: Actor,
  input: { collectionId: string; orderedProductIds: string[] },
): Promise<Mutation<{ count: number }>> {
  return db.$transaction(async (tx) => {
    await manualCollection(tx, input.collectionId);
    const current = await repo.listCollectionProducts(tx, input.collectionId);
    const ids = new Set(current.map((m) => m.productId));
    if (
      input.orderedProductIds.length !== ids.size ||
      !input.orderedProductIds.every((id) => ids.has(id))
    ) {
      throw new DomainError('VALIDATION', 'The list changed. Reload and try again.');
    }
    await repo.setCollectionPositions(tx, input.collectionId, input.orderedProductIds);
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.products_reorder',
      entity: 'collection',
      entityId: input.collectionId,
      after: { orderedProductIds: input.orderedProductIds },
    });
    return {
      data: { count: input.orderedProductIds.length },
      tags: catalogTags({ collections: [input.collectionId] }),
    };
  });
}

export async function setCollectionHero(
  actor: Actor,
  input: { collectionId: string; alt: string; bytes: Buffer },
): Promise<Mutation<{ url: string }>> {
  const image = await prepareImage(input.bytes, 'collections', input.alt);
  let oldKey: string | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      const before = await repo.findCollection(tx, input.collectionId);
      if (!before) throw notFound('Collection');
      oldKey = (before.heroMedia as { storageKey?: string | null } | null)?.storageKey ?? null;
      await repo.updateCollection(tx, before.id, {
        heroMedia: image.stored as unknown as Prisma.InputJsonObject,
      });
      await audit(tx, {
        ...auditBase(actor),
        action: 'collection.hero_set',
        entity: 'collection',
        entityId: before.id,
        after: { url: image.stored.url, alt: input.alt },
      });
      return { data: { url: image.stored.url }, tags: catalogTags({ collections: [before.id] }) };
    });
    await discardImage(oldKey);
    return result;
  } catch (error) {
    await discardImage(image.stored.storageKey);
    throw error;
  }
}

export async function removeCollectionHero(
  actor: Actor,
  id: string,
): Promise<Mutation<{ id: string }>> {
  let oldKey: string | null = null;
  const result = await db.$transaction(async (tx) => {
    const before = await repo.findCollection(tx, id);
    if (!before) throw notFound('Collection');
    oldKey = (before.heroMedia as { storageKey?: string | null } | null)?.storageKey ?? null;
    await repo.updateCollection(tx, id, { heroMedia: Prisma.DbNull });
    await audit(tx, {
      ...auditBase(actor),
      action: 'collection.hero_remove',
      entity: 'collection',
      entityId: id,
    });
    return { data: { id }, tags: catalogTags({ collections: [id] }) };
  });
  await discardImage(oldKey);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Cost basis and lookups for other modules (inventory, purchasing)
// ---------------------------------------------------------------------------------------------

export interface VariantCost {
  id: string;
  productId: string;
  currency: string;
  avgCostMinor: bigint;
}

/** Locks the variants (stable order) and returns their cost basis. Call inside a transaction. */
export async function lockVariantCosts(
  tx: Tx,
  variantIds: readonly string[],
): Promise<Map<string, VariantCost>> {
  const rows = await repo.lockVariantCosts(tx, variantIds);
  return new Map(rows.map((row) => [row.id, row]));
}

/** Stores a recalculated weighted average cost (purchasing owns the formula). */
export async function setVariantAverageCost(
  tx: Tx,
  variantId: string,
  avgCostMinor: bigint,
): Promise<void> {
  if (avgCostMinor < 0n) throw new DomainError('VALIDATION', 'Cost cannot be negative');
  await repo.setVariantAvgCost(tx, variantId, avgCostMinor);
}

/** Product ids for variants, so stock writes can invalidate the product tags too. */
export async function productIdsForVariants(
  tx: Tx,
  variantIds: readonly string[],
): Promise<Map<string, string>> {
  const rows = await repo.listVariantProductIds(tx, variantIds);
  return new Map(rows.map((row) => [row.id, row.productId]));
}

export interface VariantLabel {
  id: string;
  sku: string;
  productTitle: string;
  /** For example White / M / Slim. */
  optionsLabel: string;
}

/** Human labels for variants (purchase orders, stock screens). Unknown ids are left out. */
export async function variantLabels(
  tx: Tx,
  variantIds: readonly string[],
): Promise<Map<string, VariantLabel>> {
  const rows = await repo.listVariantLabels(tx, variantIds);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        sku: row.sku,
        productTitle: row.product.title,
        optionsLabel: row.optionValues
          .map((entry) => entry.optionValue)
          .sort((a, b) => a.option.position - b.option.position)
          .map((value) => value.label)
          .join(' / '),
      },
    ]),
  );
}

/** A variant as the bag and checkout need it: what it is, what it sells for and what it cost. */
export interface SellableVariant {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  sku: string;
  /** For example White / M / Slim. */
  optionsLabel: string;
  options: Array<{ name: string; value: string }>;
  priceMinor: bigint;
  compareAtMinor: bigint | null;
  /** Weighted average landed cost; zero means no cost basis has been recorded yet. */
  avgCostMinor: bigint;
  currency: string;
  image: { url: string; alt: string } | null;
  /** Active variant of a published, live product. Anything else cannot be bought. */
  sellable: boolean;
}

/**
 * Reads variants for the bag, the checkout and order snapshots. Unknown ids are left out. Prices
 * come from the database here and nowhere else: the browser never states a price (INV-M3).
 */
export async function getSellableVariants(
  tx: Tx,
  variantIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, SellableVariant>> {
  if (variantIds.length === 0) return new Map();
  const rows = await repo.listSellableVariantRows(tx, [...new Set(variantIds)]);
  return new Map(
    rows.map((row) => {
      const ordered = [...row.optionValues].sort(
        (a, b) => a.optionValue.option.position - b.optionValue.option.position,
      );
      const valueIds = new Set(ordered.map((entry) => entry.optionValueId));
      const media =
        row.product.media.find((m) => m.optionValueId && valueIds.has(m.optionValueId)) ??
        row.product.media.find((m) => m.optionValueId === null) ??
        row.product.media[0];
      const live =
        row.status === 'active' &&
        row.product.status === 'active' &&
        row.product.deletedAt === null &&
        row.product.publishedAt !== null &&
        row.product.publishedAt <= now;
      const variant: SellableVariant = {
        id: row.id,
        productId: row.product.id,
        productTitle: row.product.title,
        productSlug: row.product.slug,
        sku: row.sku,
        optionsLabel: ordered.map((entry) => entry.optionValue.label).join(' / '),
        options: ordered.map((entry) => ({
          name: entry.optionValue.option.name,
          value: entry.optionValue.label,
        })),
        priceMinor: row.priceMinor,
        compareAtMinor: row.compareAtMinor,
        avgCostMinor: row.avgCostMinor,
        currency: row.currency,
        image: media ? { url: media.url, alt: media.alt } : null,
        sellable: live,
      };
      return [row.id, variant] as const;
    }),
  );
}
