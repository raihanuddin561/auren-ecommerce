import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { format, money, serialize, toDecimalString, type SerializedMoney } from '@/lib/money';
import { EMPTY_RULES, type CollectionRules } from './collection-rules';
import {
  SNAPSHOT_LIMIT,
  isRedirectablePath,
  readRedirectSnapshot,
  staleRedirectSnapshot,
  writeRedirectSnapshot,
  type CachedRedirect,
} from './redirect-cache';
import * as repo from './repository';
import { collectionTag, TAG_CATEGORIES, TAG_COLLECTIONS, TAG_PRODUCTS } from './tags';
import { CATALOG_CURRENCY, type StoredImage } from './types';

/**
 * Reads for the console (uncached: they are called after the staff check, and staff must see their
 * own edits immediately) and for the storefront (cached with tags that the writes invalidate).
 */

const priceLabel = (minor: bigint, currency = CATALOG_CURRENCY) =>
  format(money(minor, currency), { trimZeroFraction: true });

// ---------------------------------------------------------------------------------------------
// Console: categories
// ---------------------------------------------------------------------------------------------

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  image: string | null;
  imageAlt: string | null;
  /** Ids of the siblings in order, for reordering. */
  siblingIds: string[];
}

/** The whole tree, depth first, each level in its stored order. */
export async function listCategoryTree(): Promise<CategoryRow[]> {
  const all = await repo.listCategories(db);
  const children = new Map<string | null, typeof all>();
  for (const category of all) {
    const list = children.get(category.parentId) ?? [];
    list.push(category);
    children.set(category.parentId, list);
  }
  const rows: CategoryRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const siblings = children.get(parentId) ?? [];
    const siblingIds = siblings.map((s) => s.id);
    for (const category of siblings) {
      rows.push({
        id: category.id,
        parentId: category.parentId,
        name: category.name,
        slug: category.slug,
        path: category.path,
        depth,
        position: category.position,
        isActive: category.isActive,
        productCount: category._count.products,
        childCount: category._count.children,
        image: category.image,
        imageAlt: category.imageAlt,
        siblingIds,
      });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export async function getCategoryForEdit(id: string) {
  const category = await repo.findCategory(db, id);
  if (!category) return null;
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    path: category.path,
    description: category.description,
    isActive: category.isActive,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    image: category.image,
    imageAlt: category.imageAlt,
  };
}

// ---------------------------------------------------------------------------------------------
// Console: products
// ---------------------------------------------------------------------------------------------

export interface ProductListRow {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  categoryName: string | null;
  variantCount: number;
  priceRange: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  updatedAt: Date;
}

export interface ProductListParams {
  q?: string | undefined;
  status?: 'draft' | 'active' | 'archived' | undefined;
  categoryId?: string | undefined;
  page: number;
  pageSize: number;
  sort: repo.ProductSort;
}

export async function listProductsForAdmin(params: ProductListParams) {
  const { rows, total } = await repo.listProducts(
    db,
    { q: params.q, status: params.status, categoryId: params.categoryId },
    { skip: (params.page - 1) * params.pageSize, take: params.pageSize, sort: params.sort },
  );
  const items: ProductListRow[] = rows.map((p) => {
    const prices = p.variants.filter((v) => v.status !== 'archived').map((v) => v.priceMinor);
    const min = prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : null;
    const max = prices.length > 0 ? prices.reduce((a, b) => (a > b ? a : b)) : null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      categoryName: p.category?.name ?? null,
      variantCount: p.variants.length,
      priceRange:
        min === null || max === null
          ? null
          : min === max
            ? priceLabel(min)
            : `${priceLabel(min)} to ${priceLabel(max)}`,
      imageUrl: p.media[0]?.url ?? null,
      imageAlt: p.media[0]?.alt ?? null,
      updatedAt: p.updatedAt,
    };
  });
  return { items, total, page: params.page, pageSize: params.pageSize };
}

export interface VariantDetail {
  id: string;
  sku: string;
  barcode: string | null;
  /** Decimal text for the form, e.g. "2490.00". */
  price: string;
  priceLabel: string;
  compareAt: string;
  weightG: number | null;
  status: 'draft' | 'active' | 'archived';
  isDefault: boolean;
  labels: string[];
  optionValueIds: string[];
  onHand: number;
}

export interface ProductDetail {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  categoryId: string | null;
  sizeChartId: string | null;
  productType: string | null;
  material: string | null;
  careInstructions: string | null;
  fit: 'slim' | 'regular' | 'relaxed' | null;
  origin: string | null;
  tags: string[];
  attributes: { fabric: string; occasion: string; season: string; pattern: string };
  featuredRank: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string; label: string; swatchHex: string | null }>;
  }>;
  variants: VariantDetail[];
  media: Array<{
    id: string;
    url: string;
    alt: string;
    optionValueId: string | null;
    width: number | null;
    height: number | null;
  }>;
}

const attr = (value: unknown, key: string): string => {
  const record = value as Record<string, unknown> | null;
  const found = record?.[key];
  return typeof found === 'string' ? found : '';
};

export async function getProductForAdmin(id: string): Promise<ProductDetail | null> {
  const p = await repo.findProductDetail(db, id);
  if (!p) return null;
  const optionOrder = p.options.map((o) => o.id);
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    slug: p.slug,
    status: p.status,
    categoryId: p.categoryId,
    sizeChartId: p.sizeChartId,
    productType: p.productType,
    material: p.material,
    careInstructions: p.careInstructions,
    fit: p.fit,
    origin: p.origin,
    tags: p.tags,
    attributes: {
      fabric: attr(p.attributes, 'fabric'),
      occasion: attr(p.attributes, 'occasion'),
      season: attr(p.attributes, 'season'),
      pattern: attr(p.attributes, 'pattern'),
    },
    featuredRank: p.featuredRank,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values.map((v) => ({
        id: v.id,
        value: v.value,
        label: v.label,
        swatchHex: v.swatchHex,
      })),
    })),
    variants: p.variants.map((v) => {
      const byOption = new Map(
        v.optionValues.map((ov) => [ov.optionValue.optionId, ov.optionValue]),
      );
      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        price: toDecimalString(money(v.priceMinor, v.currency)),
        priceLabel: priceLabel(v.priceMinor, v.currency),
        compareAt:
          v.compareAtMinor === null ? '' : toDecimalString(money(v.compareAtMinor, v.currency)),
        weightG: v.weightG,
        status: v.status,
        isDefault: v.isDefault,
        labels: optionOrder.map((optionId) => byOption.get(optionId)?.label ?? ''),
        optionValueIds: v.optionValues.map((ov) => ov.optionValueId),
        onHand: v.inventory.reduce((n, level) => n + level.onHand, 0),
      };
    }),
    media: p.media.map((m) => ({
      id: m.id,
      url: m.url,
      alt: m.alt,
      optionValueId: m.optionValueId,
      width: m.width,
      height: m.height,
    })),
  };
}

export async function listCategoryOptions() {
  const rows = await listCategoryTree();
  return rows.map((c) => ({ id: c.id, label: `${'– '.repeat(c.depth)}${c.name}`, depth: c.depth }));
}

// ---------------------------------------------------------------------------------------------
// Console: size charts
// ---------------------------------------------------------------------------------------------

export interface SizeChartTable {
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
}

const toTable = (value: unknown): SizeChartTable => {
  const t = value as Partial<SizeChartTable> | null;
  return {
    columns: Array.isArray(t?.columns) ? t.columns : [],
    rows: Array.isArray(t?.rows) ? t.rows : [],
  };
};

export async function listSizeChartsForAdmin() {
  const rows = await repo.listSizeCharts(db);
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    unit: c.unit as 'cm' | 'in',
    sizes: toTable(c.table).rows.length,
    measurements: toTable(c.table).columns.length,
    productCount: c._count.products,
    updatedAt: c.updatedAt,
  }));
}

export async function getSizeChartForAdmin(id: string) {
  const chart = await repo.findSizeChart(db, id);
  if (!chart) return null;
  return {
    id: chart.id,
    name: chart.name,
    unit: chart.unit as 'cm' | 'in',
    table: toTable(chart.table),
    howToMeasure: chart.howToMeasure,
    modelInfo: chart.modelInfo,
    productCount: chart._count.products,
  };
}

export async function listSizeChartOptions() {
  const rows = await repo.listSizeCharts(db);
  return rows.map((c) => ({ id: c.id, label: c.name }));
}

// ---------------------------------------------------------------------------------------------
// Console: collections
// ---------------------------------------------------------------------------------------------

export type CollectionState = 'draft' | 'scheduled' | 'live';

export const collectionState = (publishedAt: Date | null, now = new Date()): CollectionState =>
  publishedAt === null ? 'draft' : publishedAt.getTime() > now.getTime() ? 'scheduled' : 'live';

export async function listCollectionsForAdmin() {
  const rows = await repo.listCollections(db);
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    type: c.type as 'manual' | 'automatic',
    state: collectionState(c.publishedAt),
    publishedAt: c.publishedAt,
    isFeatured: c.isFeatured,
    productCount: c._count.products,
  }));
}

const toRules = (value: unknown): CollectionRules => {
  const rules = value as Partial<CollectionRules> | null;
  return rules && Array.isArray(rules.conditions)
    ? { match: rules.match === 'any' ? 'any' : 'all', conditions: rules.conditions }
    : EMPTY_RULES;
};

export async function getCollectionForAdmin(id: string) {
  const collection = await repo.findCollection(db, id);
  if (!collection) return null;
  const members = await repo.listCollectionProducts(db, id);
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    type: collection.type as 'manual' | 'automatic',
    rules: toRules(collection.rules),
    sortOrder: collection.sortOrder as
      'manual' | 'best_selling' | 'newest' | 'price_asc' | 'price_desc',
    seoTitle: collection.seoTitle,
    seoDescription: collection.seoDescription,
    publishedAt: collection.publishedAt,
    state: collectionState(collection.publishedAt),
    isFeatured: collection.isFeatured,
    hero: (collection.heroMedia as StoredImage | null) ?? null,
    members: members.map((m) => ({
      productId: m.productId,
      title: m.product.title,
      status: m.product.status,
      imageUrl: m.product.media[0]?.url ?? null,
      imageAlt: m.product.media[0]?.alt ?? null,
    })),
  };
}

export async function listRedirectsForAdmin() {
  return repo.listRedirects(db);
}

// ---------------------------------------------------------------------------------------------
// Proxy: slug redirects
// ---------------------------------------------------------------------------------------------

const lastHitBump = new Map<string, number>();

/** Counts a served redirect, at most once a minute per address (it is a statistic, not a ledger). */
function noteRedirectHit(path: string): void {
  const now = Date.now();
  if ((lastHitBump.get(path) ?? 0) + 60_000 > now) return;
  if (lastHitBump.size > 1_000) lastHitBump.clear();
  lastHitBump.set(path, now);
  void repo.bumpRedirectHits(db, path).catch(() => undefined);
}

/**
 * Where an old address now lives, or null. Called by the request proxy for product, collection
 * and category paths only. The whole table is cached as one snapshot, so unknown addresses cost
 * nothing, and a database problem never blocks a page view: it answers with the last snapshot or
 * "no redirect".
 */
export async function resolveRedirect(pathname: string): Promise<CachedRedirect | null> {
  if (!isRedirectablePath(pathname)) return null;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  let map = readRedirectSnapshot();
  if (!map) {
    try {
      map = writeRedirectSnapshot(await repo.listRedirects(db, SNAPSHOT_LIMIT));
    } catch {
      map = staleRedirectSnapshot() ?? new Map();
    }
  }
  const found = map.get(normalized) ?? null;
  if (found) noteRedirectHit(normalized);
  return found;
}

// ---------------------------------------------------------------------------------------------
// Storefront (cached, invalidated by tags)
// ---------------------------------------------------------------------------------------------

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  price: SerializedMoney;
  compareAt: SerializedMoney | null;
  priceLabel: string;
  compareAtLabel: string | null;
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  hoverImage: { url: string; alt: string } | null;
}

type CardRow = Awaited<ReturnType<typeof repo.listPublishedProducts>>[number];

function toCard(p: CardRow): ProductCardData | null {
  const variant = p.variants[0];
  if (!variant) return null;
  const compareAt =
    variant.compareAtMinor && variant.compareAtMinor > variant.priceMinor
      ? variant.compareAtMinor
      : null;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    categoryName: p.category?.name ?? null,
    price: serialize(money(variant.priceMinor, variant.currency)),
    compareAt: compareAt === null ? null : serialize(money(compareAt, variant.currency)),
    priceLabel: priceLabel(variant.priceMinor, variant.currency),
    compareAtLabel: compareAt === null ? null : priceLabel(compareAt, variant.currency),
    image: p.media[0]
      ? {
          url: p.media[0].url,
          alt: p.media[0].alt,
          width: p.media[0].width,
          height: p.media[0].height,
        }
      : null,
    hoverImage: p.media[1] ? { url: p.media[1].url, alt: p.media[1].alt } : null,
  };
}

const present = <T>(value: T | null): value is T => value !== null;

/** Newest published products with a sellable variant, for the home page. */
export async function getNewArrivals(limit = 8): Promise<ProductCardData[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(TAG_PRODUCTS);
  const rows = await repo.listPublishedProducts(db, {
    now: new Date(),
    take: limit * 2,
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toCard).filter(present).slice(0, limit);
}

export interface TopCategory {
  id: string;
  name: string;
  slug: string;
  path: string;
  image: string | null;
  imageAlt: string | null;
}

export async function getTopCategories(): Promise<TopCategory[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(TAG_CATEGORIES);
  const rows = await repo.listActiveCategories(db);
  return rows
    .filter((c) => c.parentId === null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      path: c.path,
      image: c.image,
      imageAlt: c.imageAlt,
    }));
}

export interface FeaturedCollection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hero: { url: string; alt: string } | null;
  products: ProductCardData[];
}

/** Published collections (featured first) with a few products each, for the home page. */
export async function getFeaturedCollections(
  limit = 2,
  perCollection = 4,
): Promise<FeaturedCollection[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(TAG_COLLECTIONS, TAG_PRODUCTS);
  const now = new Date();
  const collections = await repo.listPublishedCollections(db, now, limit);
  const result: FeaturedCollection[] = [];
  for (const collection of collections) {
    cacheTag(collectionTag(collection.id));
    const members = await repo.listPublishedCollectionProducts(
      db,
      collection.id,
      now,
      perCollection * 2,
    );
    const hero = collection.heroMedia as StoredImage | null;
    result.push({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      hero: hero ? { url: hero.url, alt: hero.alt } : null,
      products: members
        .map((m) => toCard(m.product as unknown as CardRow))
        .filter(present)
        .slice(0, perCollection),
    });
  }
  return result;
}
