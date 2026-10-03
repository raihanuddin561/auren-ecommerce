import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import type { CollectionRules } from './collection-rules';

/** Data access for the catalogue. No business rules here: the service decides, this reads and writes. */

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

export const listCategories = (tx: Tx) =>
  tx.category.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, children: true } } },
  });

export const findCategory = (tx: Tx, id: string) => tx.category.findUnique({ where: { id } });

export const findCategorySibling = (tx: Tx, parentId: string | null, slug: string) =>
  tx.category.findFirst({ where: { parentId, slug } });

export const createCategory = (tx: Tx, data: Prisma.CategoryUncheckedCreateInput) =>
  tx.category.create({ data });

export const updateCategory = (tx: Tx, id: string, data: Prisma.CategoryUncheckedUpdateInput) =>
  tx.category.update({ where: { id }, data });

export const listCategoryDescendants = (tx: Tx, path: string) =>
  tx.category.findMany({ where: { path: { startsWith: `${path}/` } }, orderBy: { path: 'asc' } });

export const countCategoryDependents = async (tx: Tx, id: string) => ({
  children: await tx.category.count({ where: { parentId: id } }),
  products: await tx.product.count({ where: { categoryId: id } }),
});

export const deleteCategory = (tx: Tx, id: string) => tx.category.delete({ where: { id } });

export async function maxCategoryPosition(tx: Tx, parentId: string | null): Promise<number> {
  const row = await tx.category.aggregate({ where: { parentId }, _max: { position: true } });
  return row._max.position ?? -1;
}

export async function setCategoryPositions(tx: Tx, orderedIds: readonly string[]): Promise<void> {
  for (const [position, id] of orderedIds.entries()) {
    await tx.category.update({ where: { id }, data: { position } });
  }
}

export const listCategoryIdsBySiblingParent = (tx: Tx, parentId: string | null) =>
  tx.category.findMany({ where: { parentId }, select: { id: true } });

// ---------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------

export interface ProductListFilter {
  q?: string | undefined;
  status?: 'draft' | 'active' | 'archived' | undefined;
  categoryId?: string | undefined;
}

const productWhere = (filter: ProductListFilter): Prisma.ProductWhereInput => ({
  deletedAt: null,
  ...(filter.status ? { status: filter.status } : {}),
  ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
  ...(filter.q
    ? {
        OR: [
          { title: { contains: filter.q, mode: 'insensitive' } },
          { slug: { contains: filter.q, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: filter.q, mode: 'insensitive' } } } },
        ],
      }
    : {}),
});

export type ProductSort = 'updated' | 'title' | 'status';

const productOrder = (sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] =>
  sort === 'title'
    ? [{ title: 'asc' }]
    : sort === 'status'
      ? [{ status: 'asc' }, { updatedAt: 'desc' }]
      : [{ updatedAt: 'desc' }, { id: 'desc' }];

export async function listProducts(
  tx: Tx,
  filter: ProductListFilter,
  page: { skip: number; take: number; sort: ProductSort },
) {
  const where = productWhere(filter);
  const [rows, total] = await Promise.all([
    tx.product.findMany({
      where,
      orderBy: productOrder(page.sort),
      skip: page.skip,
      take: page.take,
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          select: { id: true, priceMinor: true, currency: true, status: true },
          orderBy: { position: 'asc' },
        },
        media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 1 },
      },
    }),
    tx.product.count({ where }),
  ]);
  return { rows, total };
}

export const findProductDetail = (tx: Tx, id: string) =>
  tx.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      sizeChart: { select: { id: true, name: true } },
      options: {
        orderBy: { position: 'asc' },
        include: { values: { orderBy: { position: 'asc' } } },
      },
      variants: {
        orderBy: { position: 'asc' },
        include: {
          optionValues: {
            include: {
              optionValue: { select: { id: true, value: true, label: true, optionId: true } },
            },
          },
          inventory: { select: { onHand: true, reserved: true } },
        },
      },
      media: { orderBy: { position: 'asc' } },
    },
  });

export const findProduct = (tx: Tx, id: string) =>
  tx.product.findFirst({ where: { id, deletedAt: null } });

/**
 * Reads a product and locks its row until the transaction ends. Every write that can change
 * whether a product is sellable (status, variants, images, category) takes this lock first, so two
 * staff members cannot each pass a readiness check against the other's half-finished change.
 */
export async function findProductForUpdate(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
  return tx.product.findFirst({ where: { id, deletedAt: null } });
}

export const findProductBySlug = (tx: Tx, slug: string) =>
  tx.product.findUnique({ where: { slug } });

export const createProduct = (tx: Tx, data: Prisma.ProductUncheckedCreateInput) =>
  tx.product.create({ data });

export const updateProduct = (tx: Tx, id: string, data: Prisma.ProductUncheckedUpdateInput) =>
  tx.product.update({ where: { id }, data });

/** Everything the status gate needs to decide whether a product may go live. */
export async function productReadiness(tx: Tx, id: string) {
  const [variants, images, product] = await Promise.all([
    tx.productVariant.findMany({
      where: { productId: id, status: 'active' },
      select: { priceMinor: true },
    }),
    tx.productMedia.count({ where: { productId: id, type: 'image' } }),
    tx.product.findUnique({ where: { id }, select: { title: true, categoryId: true } }),
  ]);
  return {
    activeVariants: variants.length,
    pricedVariants: variants.filter((v) => v.priceMinor > 0n).length,
    images,
    hasCategory: Boolean(product?.categoryId),
  };
}

// ---------------------------------------------------------------------------------------------
// Options and variants
// ---------------------------------------------------------------------------------------------

export const listOptions = (tx: Tx, productId: string) =>
  tx.productOption.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  });

export const listVariantsWithValues = (tx: Tx, productId: string) =>
  tx.productVariant.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    include: {
      optionValues: {
        include: { optionValue: { select: { value: true, optionId: true } } },
      },
      _count: { select: { inventory: true, movements: true } },
    },
  });

export const upsertOption = (tx: Tx, productId: string, name: string, position: number) =>
  tx.productOption.upsert({
    where: { productId_name: { productId, name } },
    create: { productId, name, position },
    update: { position },
  });

export const updateOption = (tx: Tx, id: string, name: string, position: number) =>
  tx.productOption.update({ where: { id }, data: { name, position } });

export const updateOptionValue = (
  tx: Tx,
  id: string,
  data: { value: string; label: string; swatchHex: string | null; position: number },
) => tx.productOptionValue.update({ where: { id }, data });

export const unlinkVariantValues = (tx: Tx, variantId: string) =>
  tx.variantOptionValue.deleteMany({ where: { variantId } });

export const deleteOptionsExcept = (tx: Tx, productId: string, keepIds: readonly string[]) =>
  tx.productOption.deleteMany({ where: { productId, id: { notIn: [...keepIds] } } });

export const upsertOptionValue = (
  tx: Tx,
  optionId: string,
  value: { value: string; label: string; swatchHex: string | null; position: number },
) =>
  tx.productOptionValue.upsert({
    where: { optionId_value: { optionId, value: value.value } },
    create: { optionId, ...value },
    update: { label: value.label, swatchHex: value.swatchHex, position: value.position },
  });

export const deleteOptionValuesExcept = (tx: Tx, optionId: string, keepIds: readonly string[]) =>
  tx.productOptionValue.deleteMany({ where: { optionId, id: { notIn: [...keepIds] } } });

export const createVariant = (tx: Tx, data: Prisma.ProductVariantUncheckedCreateInput) =>
  tx.productVariant.create({ data });

export const linkVariantValues = (tx: Tx, variantId: string, optionValueIds: readonly string[]) =>
  tx.variantOptionValue.createMany({
    data: optionValueIds.map((optionValueId) => ({ variantId, optionValueId })),
  });

export const deleteVariant = (tx: Tx, id: string) => tx.productVariant.delete({ where: { id } });

export const archiveVariant = (tx: Tx, id: string) =>
  tx.productVariant.update({ where: { id }, data: { status: 'archived' } });

export const updateVariant = (
  tx: Tx,
  id: string,
  data: Prisma.ProductVariantUncheckedUpdateInput,
) => tx.productVariant.update({ where: { id }, data });

export const findVariantsByIds = (tx: Tx, productId: string, ids: readonly string[]) =>
  tx.productVariant.findMany({ where: { productId, id: { in: [...ids] } } });

export const countProductVariants = (tx: Tx, productId: string) =>
  tx.productVariant.count({ where: { productId } });

export async function existingSkus(tx: Tx, skus: readonly string[]): Promise<Set<string>> {
  const rows = await tx.productVariant.findMany({
    where: { sku: { in: [...skus] } },
    select: { sku: true },
  });
  return new Set(rows.map((r) => r.sku));
}

export const setDefaultVariant = async (tx: Tx, productId: string): Promise<void> => {
  const variants = await tx.productVariant.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  for (const [index, variant] of variants.entries()) {
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { isDefault: index === 0, position: index },
    });
  }
};

// ---------------------------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------------------------

export const listMedia = (tx: Tx, productId: string) =>
  tx.productMedia.findMany({ where: { productId }, orderBy: { position: 'asc' } });

export const findMedia = (tx: Tx, id: string) => tx.productMedia.findUnique({ where: { id } });

export const countMedia = (tx: Tx, productId: string) =>
  tx.productMedia.count({ where: { productId } });

export const createMedia = (tx: Tx, data: Prisma.ProductMediaUncheckedCreateInput) =>
  tx.productMedia.create({ data });

export const updateMedia = (tx: Tx, id: string, data: Prisma.ProductMediaUncheckedUpdateInput) =>
  tx.productMedia.update({ where: { id }, data });

export const deleteMedia = (tx: Tx, id: string) => tx.productMedia.delete({ where: { id } });

export async function setMediaPositions(tx: Tx, orderedIds: readonly string[]): Promise<void> {
  for (const [position, id] of orderedIds.entries()) {
    await tx.productMedia.update({ where: { id }, data: { position } });
  }
}

export const findOptionValue = (tx: Tx, id: string) =>
  tx.productOptionValue.findUnique({
    where: { id },
    select: { id: true, option: { select: { productId: true } } },
  });

// ---------------------------------------------------------------------------------------------
// Size charts
// ---------------------------------------------------------------------------------------------

export const listSizeCharts = (tx: Tx) =>
  tx.sizeChart.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

export const findSizeChart = (tx: Tx, id: string) =>
  tx.sizeChart.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });

export const createSizeChart = (tx: Tx, data: Prisma.SizeChartCreateInput) =>
  tx.sizeChart.create({ data });

export const updateSizeChart = (tx: Tx, id: string, data: Prisma.SizeChartUpdateInput) =>
  tx.sizeChart.update({ where: { id }, data });

export const deleteSizeChart = (tx: Tx, id: string) => tx.sizeChart.delete({ where: { id } });

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

export const listCollections = (tx: Tx) =>
  tx.collection.findMany({
    orderBy: [{ isFeatured: 'desc' }, { title: 'asc' }],
    include: { _count: { select: { products: true } } },
  });

export const findCollection = (tx: Tx, id: string) =>
  tx.collection.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });

export const findCollectionBySlug = (tx: Tx, slug: string) =>
  tx.collection.findUnique({ where: { slug } });

export const createCollection = (tx: Tx, data: Prisma.CollectionUncheckedCreateInput) =>
  tx.collection.create({ data });

export const updateCollection = (tx: Tx, id: string, data: Prisma.CollectionUncheckedUpdateInput) =>
  tx.collection.update({ where: { id }, data });

export const deleteCollection = (tx: Tx, id: string) => tx.collection.delete({ where: { id } });

export const listCollectionProducts = (tx: Tx, collectionId: string) =>
  tx.collectionProduct.findMany({
    where: { collectionId },
    orderBy: [{ position: 'asc' }, { productId: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 1 },
        },
      },
    },
  });

export async function maxCollectionPosition(tx: Tx, collectionId: string): Promise<number> {
  const row = await tx.collectionProduct.aggregate({
    where: { collectionId },
    _max: { position: true },
  });
  return row._max.position ?? -1;
}

export const addCollectionProducts = (
  tx: Tx,
  collectionId: string,
  rows: ReadonlyArray<{ productId: string; position: number }>,
) =>
  tx.collectionProduct.createMany({
    data: rows.map((r) => ({ collectionId, ...r })),
    skipDuplicates: true,
  });

export const removeCollectionProduct = (tx: Tx, collectionId: string, productId: string) =>
  tx.collectionProduct.deleteMany({ where: { collectionId, productId } });

export async function setCollectionPositions(
  tx: Tx,
  collectionId: string,
  orderedProductIds: readonly string[],
): Promise<void> {
  for (const [position, productId] of orderedProductIds.entries()) {
    await tx.collectionProduct.updateMany({
      where: { collectionId, productId },
      data: { position },
    });
  }
}

/** Replaces the whole membership (automatic collections after their rules ran). */
export async function replaceCollectionProducts(
  tx: Tx,
  collectionId: string,
  productIds: readonly string[],
): Promise<void> {
  await tx.collectionProduct.deleteMany({ where: { collectionId } });
  if (productIds.length === 0) return;
  await tx.collectionProduct.createMany({
    data: productIds.map((productId, position) => ({ collectionId, productId, position })),
  });
}

export const listAutomaticCollections = (tx: Tx) =>
  tx.collection.findMany({ where: { type: 'automatic' } });

export const findProductsByIds = (tx: Tx, ids: readonly string[]) =>
  tx.product.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: { id: true, title: true, status: true },
  });

/** For the "add products" picker: matches by title, SKU or slug, excluding current members. */
export const searchProductsForPicker = (tx: Tx, q: string, excludeIds: readonly string[]) =>
  tx.product.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...excludeIds] },
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  });

/**
 * The database filter for an automatic collection's rules. Only active, not deleted products
 * qualify. Price compares against the lowest active variant price, in minor units.
 */
export function rulesToWhere(
  rules: CollectionRules,
  priceToMinor: (decimal: string) => bigint,
): Prisma.ProductWhereInput {
  const parts: Prisma.ProductWhereInput[] = rules.conditions.map((c): Prisma.ProductWhereInput => {
    const negate = c.operator === 'not_equals';
    switch (c.field) {
      case 'tag':
        return negate
          ? { NOT: { tags: { has: c.value.toLowerCase() } } }
          : { tags: { has: c.value.toLowerCase() } };
      // "is not" keeps products where the field is empty: SQL NOT alone would drop them.
      case 'category':
        return negate
          ? { OR: [{ categoryId: null }, { NOT: { categoryId: c.value } }] }
          : { categoryId: c.value };
      case 'fit':
        return negate
          ? { OR: [{ fit: null }, { NOT: { fit: c.value as 'slim' } }] }
          : { fit: c.value as 'slim' };
      case 'product_type':
        return negate
          ? {
              OR: [
                { productType: null },
                { NOT: { productType: { equals: c.value, mode: 'insensitive' } } },
              ],
            }
          : { productType: { equals: c.value, mode: 'insensitive' } };
      case 'price': {
        // Compared with the LOWEST active variant price: below X means some active variant is below
        // X; above X means every active variant is above X (and there is one).
        const minor = priceToMinor(c.value);
        return c.operator === 'less_than'
          ? { variants: { some: { status: 'active', priceMinor: { lt: minor } } } }
          : {
              variants: {
                some: { status: 'active' },
                none: { status: 'active', priceMinor: { lte: minor } },
              },
            };
      }
    }
  });
  const base: Prisma.ProductWhereInput = { status: 'active', deletedAt: null };
  if (parts.length === 0) return { ...base, id: { in: [] } };
  return { ...base, ...(rules.match === 'any' ? { OR: parts } : { AND: parts }) };
}

/** An automatic collection holds at most this many products. */
export const MATCH_LIMIT = 500;

export const matchProducts = (tx: Tx, where: Prisma.ProductWhereInput, take = MATCH_LIMIT) =>
  tx.product.findMany({
    where,
    select: {
      id: true,
      title: true,
      publishedAt: true,
      featuredRank: true,
      variants: { where: { status: 'active' }, select: { priceMinor: true } },
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take,
  });

/** One writer at a time per collection while its members are rewritten. */
export const lockCollection = (tx: Tx, id: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;

export const countProducts = (tx: Tx, where: Prisma.ProductWhereInput) =>
  tx.product.count({ where });

// ---------------------------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------------------------

export const findRedirect = (tx: Tx, fromPath: string) =>
  tx.redirect.findUnique({ where: { fromPath } });

export const upsertRedirect = (tx: Tx, fromPath: string, toPath: string) =>
  tx.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath, statusCode: 301 },
    update: { toPath, statusCode: 301 },
  });

/** A page that no longer exists must not be the target of old redirects. */
export const deleteRedirectsTo = (tx: Tx, toPath: string) =>
  tx.redirect.deleteMany({ where: { toPath } });

export const deleteRedirectFrom = (tx: Tx, fromPath: string) =>
  tx.redirect.deleteMany({ where: { fromPath } });

/** Points every redirect that ended at `oldTo` at the new destination (keeps chains one hop). */
export const repointRedirects = (tx: Tx, oldTo: string, newTo: string) =>
  tx.redirect.updateMany({ where: { toPath: oldTo }, data: { toPath: newTo } });

export const listRedirects = (tx: Tx, take = 200) =>
  tx.redirect.findMany({ orderBy: { createdAt: 'desc' }, take });

export const bumpRedirectHits = (tx: Tx, fromPath: string) =>
  tx.redirect.updateMany({ where: { fromPath }, data: { hits: { increment: 1 } } });

// ---------------------------------------------------------------------------------------------
// Public reads (storefront)
// ---------------------------------------------------------------------------------------------

const publishedWhere = (now: Date): Prisma.ProductWhereInput => ({
  status: 'active',
  deletedAt: null,
  publishedAt: { lte: now },
});

const cardInclude = {
  variants: {
    where: { status: 'active' as const },
    select: { priceMinor: true, compareAtMinor: true, currency: true },
    orderBy: { priceMinor: 'asc' as const },
  },
  media: {
    select: { url: true, alt: true, width: true, height: true },
    orderBy: { position: 'asc' as const },
    take: 2,
  },
  category: { select: { name: true, slug: true, path: true } },
} satisfies Prisma.ProductInclude;

export const listPublishedProducts = (
  tx: Tx,
  options: {
    now: Date;
    take: number;
    orderBy: Prisma.ProductOrderByWithRelationInput[];
    where?: Prisma.ProductWhereInput;
  },
) =>
  tx.product.findMany({
    where: { ...publishedWhere(options.now), ...(options.where ?? {}) },
    orderBy: options.orderBy,
    take: options.take,
    include: cardInclude,
  });

export const listActiveCategories = (tx: Tx) =>
  tx.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      path: true,
      image: true,
      imageAlt: true,
    },
  });

export const listPublishedCollections = (tx: Tx, now: Date, take: number) =>
  tx.collection.findMany({
    where: { publishedAt: { lte: now } },
    orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      heroMedia: true,
      isFeatured: true,
    },
  });

/** Members of a collection in their stored order, published products only. */
export const listPublishedCollectionProducts = (
  tx: Tx,
  collectionId: string,
  now: Date,
  take: number,
) =>
  tx.collectionProduct.findMany({
    where: { collectionId, product: publishedWhere(now) },
    orderBy: [{ position: 'asc' }, { productId: 'asc' }],
    take,
    include: { product: { include: cardInclude } },
  });
