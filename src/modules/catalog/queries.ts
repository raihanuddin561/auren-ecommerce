import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { format, money, toDecimalString } from '@/lib/money';
import { EMPTY_RULES, type CollectionRules } from './collection-rules';
import {
  SNAPSHOT_LIMIT,
  isRedirectablePath,
  readRedirectSnapshot,
  staleRedirectSnapshot,
  writeRedirectSnapshot,
  type CachedRedirect,
} from './redirect-cache';
import { toCard, type ProductCardData } from './card';
import { buildPdp, type PdpData } from './pdp';
import * as repo from './repository';
import {
  buildFacets,
  defaultOrderFor,
  filterRows,
  isPlainQuery,
  LISTING_PAGE_SIZE,
  paginate,
  sortRows,
  toListingRow,
  type CollectionSortOrder,
  type DefaultOrder,
  type Facets,
  type ListingQuery,
  type ListingRow,
} from './listing';
import {
  categoryTag,
  collectionTag,
  productTag,
  TAG_CATEGORIES,
  TAG_COLLECTIONS,
  TAG_PRODUCTS,
  TAG_SITEMAP,
} from './tags';
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

export type { ProductCardData };

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
  return rows
    .map((row) => toCard(row))
    .filter(present)
    .slice(0, limit);
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
        .map((m) => toCard(m.product))
        .filter(present)
        .slice(0, perCollection),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Storefront: shop and collection pages
// ---------------------------------------------------------------------------------------------

/** `path` is the category path under /shop ("" for everything, "shirts/oxford" for a subcategory). */
export type ListingScope = { kind: 'shop'; path: string } | { kind: 'collection'; slug: string };

export interface ListingHeader {
  kind: 'shop' | 'collection';
  eyebrow: string;
  title: string;
  description: string | null;
  hero: { url: string; alt: string } | null;
  /** Address of the page without a query string. */
  basePath: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  /** Sub-categories of a category page, as links. */
  children: Array<{ label: string; href: string }>;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ListingResult {
  header: ListingHeader;
  /** Cards of the requested page; stock is not included (it is merged in live). */
  cards: ProductCardData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  facets: Facets;
  /** Newest pieces of the page's scope, only when nothing matches the filters. */
  suggestions: ProductCardData[];
  tags: string[];
}

const SHOP_DESCRIPTION =
  'Elevated essentials and tailoring, crafted in breathable fabrics and made to be worn for years.';

const COLLECTION_SORTS: readonly string[] = [
  'manual',
  'best_selling',
  'newest',
  'price_asc',
  'price_desc',
];
const asCollectionSort = (value: string): CollectionSortOrder =>
  COLLECTION_SORTS.includes(value) ? (value as CollectionSortOrder) : 'manual';

interface ResolvedScope {
  header: ListingHeader;
  filter: repo.ListingScopeFilter;
  defaultOrder: DefaultOrder;
  tags: string[];
}

async function resolveScope(scope: ListingScope, now: Date): Promise<ResolvedScope | null> {
  if (scope.kind === 'collection') {
    const collection = await repo.findPublishedCollectionBySlug(db, scope.slug, now);
    if (!collection) return null;
    const hero = collection.heroMedia as StoredImage | null;
    return {
      header: {
        kind: 'collection',
        eyebrow: 'Collection',
        title: collection.title,
        description: collection.description,
        hero: hero ? { url: hero.url, alt: hero.alt } : null,
        basePath: `/collections/${collection.slug}`,
        breadcrumb: [{ label: 'Home', href: '/' }, { label: collection.title }],
        children: [],
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
      },
      filter: { collectionId: collection.id },
      defaultOrder: defaultOrderFor(asCollectionSort(collection.sortOrder)),
      tags: [TAG_COLLECTIONS, collectionTag(collection.id)],
    };
  }

  const path = scope.path;
  if (path === '') {
    const top = (await repo.listActiveCategories(db)).filter((c) => c.parentId === null);
    return {
      header: {
        kind: 'shop',
        eyebrow: 'The collection',
        title: 'Shop all',
        description: SHOP_DESCRIPTION,
        hero: null,
        basePath: '/shop',
        breadcrumb: [{ label: 'Home', href: '/' }, { label: 'Shop' }],
        children: top.map((c) => ({ label: c.name, href: `/shop/${c.path}` })),
        seoTitle: 'Shop all menswear',
        seoDescription: SHOP_DESCRIPTION,
      },
      filter: {},
      defaultOrder: 'featured',
      tags: [TAG_CATEGORIES],
    };
  }

  const category = await repo.findActiveCategoryByPath(db, path);
  if (!category) return null;
  const segments = path.split('/');
  const ancestorPaths = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'));
  const [ancestors, subtree, children] = await Promise.all([
    ancestorPaths.length > 0 ? repo.listActiveCategoriesByPaths(db, ancestorPaths) : [],
    repo.listActiveCategorySubtreeIds(db, path),
    repo.listActiveChildCategories(db, category.id),
  ]);
  const byPath = new Map(ancestors.map((a) => [a.path, a.name]));
  const parentPath = ancestorPaths.at(-1);
  return {
    header: {
      kind: 'shop',
      eyebrow: (parentPath !== undefined ? byPath.get(parentPath) : undefined) ?? 'Shop',
      title: category.name,
      description: category.description,
      hero: category.image
        ? { url: category.image, alt: category.imageAlt ?? category.name }
        : null,
      basePath: `/shop/${category.path}`,
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Shop', href: '/shop' },
        ...ancestorPaths.flatMap((p) =>
          byPath.has(p) ? [{ label: byPath.get(p)!, href: `/shop/${p}` }] : [],
        ),
        { label: category.name },
      ],
      children: children.map((c) => ({ label: c.name, href: `/shop/${c.path}` })),
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
    },
    filter: { categoryIds: subtree.map((c) => c.id) },
    defaultOrder: 'featured',
    tags: [TAG_CATEGORIES, categoryTag(category.id)],
  };
}

const NEWEST_SUGGESTIONS = 4;

/**
 * One page of a shop or collection listing. `inStockIds` is the live set from the inventory when
 * the "In stock" filter is on, otherwise null. Uncached: the cached entry point is getListing.
 * Returns null when the category or collection does not exist (or is not live).
 */
export async function loadListing(
  scope: ListingScope,
  query: ListingQuery,
  inStockIds: ReadonlySet<string> | null = null,
): Promise<ListingResult | null> {
  const now = new Date();
  const resolved = await resolveScope(scope, now);
  if (!resolved) return null;

  const source = await repo.listProductFacetSource(db, now, resolved.filter);
  const all = source.map(toListingRow).filter((row): row is ListingRow => row !== null);
  const stockSet = query.inStock ? (inStockIds ?? new Set<string>()) : null;
  const matching = filterRows(all, query, stockSet);
  const sorted = sortRows(matching, query.sort, resolved.defaultOrder);
  const { total, totalPages } = paginate(sorted, 1);
  const start = (query.page - 1) * LISTING_PAGE_SIZE;
  const pageIds = sorted.slice(start, start + LISTING_PAGE_SIZE).map((row) => row.id);

  const suggestionIds =
    total === 0
      ? sortRows(all, 'newest', 'featured')
          .slice(0, NEWEST_SUGGESTIONS)
          .map((row) => row.id)
      : [];
  const cardRows = await repo.listCardsByIds(db, now, [...pageIds, ...suggestionIds]);
  const cards = new Map<string, ProductCardData>();
  for (const row of cardRows) {
    const card = toCard(row, now);
    if (card) cards.set(row.id, card);
  }
  const pick = (ids: string[]) => ids.flatMap((id) => cards.get(id) ?? []);

  return {
    header: resolved.header,
    cards: pick(pageIds),
    total,
    page: query.page,
    totalPages,
    pageSize: LISTING_PAGE_SIZE,
    facets: buildFacets(all, query, stockSet),
    suggestions: pick(suggestionIds),
    tags: [TAG_PRODUCTS, ...resolved.tags, ...pageIds.map(productTag)],
  };
}

/**
 * The cached entry point (ARCHITECTURE 3.3). The plain listing (no filters, default sort) is built
 * once and served for minutes; any filter or sort is a short, query-keyed entry. Invalidated by the
 * catalogue tags. Stock is never part of this: the page merges live availability in a Suspense
 * island. The "In stock" filter is the exception and goes through loadListing with the live set.
 */
export async function getListing(
  scope: ListingScope,
  query: ListingQuery,
): Promise<ListingResult | null> {
  'use cache';
  cacheLife(isPlainQuery(query) && query.page === 1 ? 'minutes' : 'seconds');
  const result = await loadListing(scope, query, null);
  if (result) cacheTag(...result.tags);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------------------------

/**
 * The cacheable shell of a product page: copy, pictures, options, size chart, breadcrumb. Price and
 * stock are deliberately not in it (see getLivePriceRows and the inventory queries). Revalidated by
 * the product tag on every product, media, variant or size chart save. Unknown, draft, archived and
 * scheduled products answer null (the page shows a 404).
 */
export async function getProductPage(slug: string): Promise<PdpData | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAG_PRODUCTS);
  const now = new Date();
  const row = await repo.findPublishedProductBySlug(db, slug, now);
  if (!row) return null;
  cacheTag(productTag(row.id));
  const [trail, lead] = await Promise.all([
    row.category ? repo.listCategoryTrail(db, row.category.path) : Promise.resolve([]),
    repo.findLeadCollection(db, row.id, now),
  ]);
  return buildPdp(row, {
    eyebrow: lead?.collection.title ?? row.category?.name ?? null,
    categoryTrail: trail.map((category) => ({
      name: category.name,
      href: `/shop/${category.path}`,
    })),
  });
}

/** Current prices of a product's active variants. Uncached: read next to the live stock. */
export const getLivePriceRows = (productId: string) => repo.listLiveVariantPrices(db, productId);

/** Other live products in the same category, as cards without stock (merge it live). */
export async function getRelatedProducts(
  productId: string,
  categoryId: string | null,
  limit = 4,
): Promise<ProductCardData[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(TAG_PRODUCTS, productTag(productId));
  if (!categoryId) return [];
  const rows = await repo.listRelatedProducts(db, {
    categoryId,
    excludeId: productId,
    now: new Date(),
    take: limit * 2,
  });
  return rows
    .map((row) => toCard(row))
    .filter(present)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------------------------

export interface SitemapEntry {
  path: string;
  lastModified: Date;
  images: string[];
}

const SITEMAP_PRODUCT_LIMIT = 5000;

/** Every live product, collection and category address, with product pictures. Tagged 'sitemap'. */
export async function listSitemapEntries(): Promise<SitemapEntry[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAG_SITEMAP);
  try {
    const now = new Date();
    const [products, collections, categories] = await Promise.all([
      repo.listSitemapProducts(db, now, SITEMAP_PRODUCT_LIMIT),
      repo.listSitemapCollections(db, now),
      repo.listSitemapCategories(db),
    ]);
    return [
      ...categories.map((row) => ({
        path: `/shop/${row.path}`,
        lastModified: row.updatedAt,
        images: [],
      })),
      ...collections.map((row) => ({
        path: `/collections/${row.slug}`,
        lastModified: row.updatedAt,
        images: [],
      })),
      ...products.map((row) => ({
        path: `/products/${row.slug}`,
        lastModified: row.updatedAt,
        images: row.media.map((media) => media.url),
      })),
    ];
  } catch (error) {
    logger.warn(
      { err: error },
      'failed to list sitemap entries from database; continuing with empty sitemap entries',
    );
    return [];
  }
}

/** Published products by id, in the order asked, for the wishlist. Not cached: the ids are personal. */
export async function getProductCardsByIds(ids: readonly string[]): Promise<ProductCardData[]> {
  const unique = [...new Set(ids)].slice(0, 60);
  if (unique.length === 0) return [];
  const rows = await repo.listPublishedProducts(db, {
    now: new Date(),
    take: unique.length,
    orderBy: [{ id: 'asc' }],
    where: { id: { in: unique } },
  });
  const byId = new Map(rows.map((row) => [row.id, toCard(row)] as const));
  return unique.map((id) => byId.get(id) ?? null).filter(present);
}
