import { z } from 'zod';
import { fromDecimalString, money, toDecimalString } from '@/lib/money';
import { CATALOG_CURRENCY } from './types';

/**
 * Pure rules of the shop and collection pages: what the URL may say (parsed with Zod, anything
 * unknown or invalid is ignored), how products are filtered, counted and sorted, and which
 * address search engines should index. No database and no React here, so the same code serves the
 * server, the filter drawer and the tests.
 */

export const LISTING_PAGE_SIZE = 24;
export const MAX_LISTING_PAGE = 500;

export const FIT_VALUES = ['slim', 'regular', 'relaxed'] as const;
export type Fit = (typeof FIT_VALUES)[number];

export const SORT_VALUES = ['featured', 'newest', 'price-asc', 'price-desc'] as const;
export type ListingSort = (typeof SORT_VALUES)[number];

export const SORT_LABELS: Record<ListingSort, string> = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
};

/**
 * Grid density in the address. 2, 3 and 4 are desktop columns; on a phone 1 is a single column and
 * anything else two. Absent means the default: two columns on a phone, four on desktop.
 */
export const DENSITY_VALUES = [1, 2, 3, 4] as const;
export type Density = (typeof DENSITY_VALUES)[number];

export interface ListingQuery {
  size: string[];
  color: string[];
  fit: Fit[];
  fabric: string[];
  /** Whole currency units as decimal text, for example "2500" or "2500.50". */
  minPrice: string | null;
  maxPrice: string | null;
  inStock: boolean;
  sort: ListingSort;
  page: number;
  density: Density | null;
}

export const EMPTY_QUERY: ListingQuery = {
  size: [],
  color: [],
  fit: [],
  fabric: [],
  minPrice: null,
  maxPrice: null,
  inStock: false,
  sort: 'featured',
  page: 1,
  density: null,
};

// ---------------------------------------------------------------------------------------------
// Parsing the address
// ---------------------------------------------------------------------------------------------

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_VALUES = 12;
const facetValue = z.string().trim().min(1).max(40);
const priceText = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/);
const flag = z.enum(['1', 'true']);

const fieldSchemas = {
  size: z.array(facetValue).max(MAX_VALUES),
  color: z.array(facetValue).max(MAX_VALUES),
  fabric: z.array(facetValue).max(MAX_VALUES),
  fit: z.array(z.enum(FIT_VALUES)).max(FIT_VALUES.length),
  minPrice: priceText,
  maxPrice: priceText,
  inStock: flag,
  sort: z.enum(SORT_VALUES),
  page: z.coerce.number().int().min(1).max(MAX_LISTING_PAGE),
  density: z.coerce
    .number()
    .int()
    .refine((n): n is Density => (DENSITY_VALUES as readonly number[]).includes(n)),
};

const asList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Valid, de-duplicated items of a repeated parameter; invalid items are dropped one by one. */
function listParam<T extends string>(
  value: string | string[] | undefined,
  item: z.ZodType<T>,
): T[] {
  const seen = new Set<T>();
  for (const raw of asList(value).slice(0, MAX_VALUES * 2)) {
    const parsed = item.safeParse(raw);
    if (parsed.success) seen.add(parsed.data);
    if (seen.size >= MAX_VALUES) break;
  }
  return [...seen];
}

/** Normalises price text so "02500.0" and "2500" produce the same address. */
function normalisePrice(text: string): string {
  return toMajor(fromDecimalString(text, CATALOG_CURRENCY).minor);
}

/** Whole units as short decimal text: 250000 minor -> "2500", 250050 -> "2500.50". */
function toMajor(minor: bigint): string {
  return toDecimalString(money(minor, CATALOG_CURRENCY)).replace(/\.00$/, '');
}

const scalar = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Reads the shop query string. Unknown keys are ignored, invalid values fall back to the default,
 * and a maximum below the minimum is dropped, so any address renders something sensible.
 */
export function parseListingQuery(raw: RawSearchParams): ListingQuery {
  const minParsed = fieldSchemas.minPrice.safeParse(scalar(raw.min));
  const maxParsed = fieldSchemas.maxPrice.safeParse(scalar(raw.max));
  const minPrice = minParsed.success ? normalisePrice(minParsed.data) : null;
  let maxPrice = maxParsed.success ? normalisePrice(maxParsed.data) : null;
  if (
    minPrice !== null &&
    maxPrice !== null &&
    fromDecimalString(maxPrice, CATALOG_CURRENCY).minor <
      fromDecimalString(minPrice, CATALOG_CURRENCY).minor
  ) {
    maxPrice = null;
  }

  const sort = fieldSchemas.sort.safeParse(scalar(raw.sort));
  const page = fieldSchemas.page.safeParse(scalar(raw.page));
  const density = fieldSchemas.density.safeParse(scalar(raw.density));
  const inStock = fieldSchemas.inStock.safeParse(scalar(raw.instock));

  return {
    size: listParam(raw.size, facetValue).sort(),
    color: listParam(raw.color, facetValue).sort(),
    fabric: listParam(raw.fabric, facetValue).sort(),
    fit: listParam(raw.fit, z.enum(FIT_VALUES)).sort(),
    minPrice,
    maxPrice,
    inStock: inStock.success,
    sort: sort.success ? sort.data : 'featured',
    page: page.success ? page.data : 1,
    density: density.success ? (density.data as Density) : null,
  };
}

/** The query string for a query: stable key order, defaults omitted, repeated keys for lists. */
export function listingSearch(query: ListingQuery): string {
  const params = new URLSearchParams();
  for (const value of query.size) params.append('size', value);
  for (const value of query.color) params.append('color', value);
  for (const value of query.fit) params.append('fit', value);
  for (const value of query.fabric) params.append('fabric', value);
  if (query.minPrice !== null) params.set('min', query.minPrice);
  if (query.maxPrice !== null) params.set('max', query.maxPrice);
  if (query.inStock) params.set('instock', '1');
  if (query.sort !== 'featured') params.set('sort', query.sort);
  if (query.density !== null) params.set('density', String(query.density));
  if (query.page > 1) params.set('page', String(query.page));
  return params.toString();
}

/** `/shop/shirts?color=white&page=2` from a base path and a query. */
export function listingHref(basePath: string, query: ListingQuery): string {
  const search = listingSearch(query);
  return search ? `${basePath}?${search}` : basePath;
}

/** Number of facet selections (page, sort and density do not count). */
export function activeFilterCount(query: ListingQuery): number {
  return (
    query.size.length +
    query.color.length +
    query.fit.length +
    query.fabric.length +
    (query.minPrice !== null || query.maxPrice !== null ? 1 : 0) +
    (query.inStock ? 1 : 0)
  );
}

export const hasFilters = (query: ListingQuery): boolean => activeFilterCount(query) > 0;

/** Without any filter, sort or density: the page the shop builds and caches for everyone. */
export const isPlainQuery = (query: ListingQuery): boolean =>
  !hasFilters(query) && query.sort === 'featured' && query.density === null;

/** Drops the facet selections and page, keeping the cosmetic choices (sort, density). */
export const withoutFilters = (query: ListingQuery): ListingQuery => ({
  ...EMPTY_QUERY,
  sort: query.sort,
  density: query.density,
});

/** The value the cache is keyed on: everything that changes which products are shown. */
export const contentQuery = (query: ListingQuery): ListingQuery => ({ ...query, density: null });

// ---------------------------------------------------------------------------------------------
// Grid density classes (literal strings so Tailwind keeps them)
// ---------------------------------------------------------------------------------------------

export function gridColumnClasses(density: Density | null): string {
  switch (density) {
    case 1:
      return 'grid-cols-1 md:grid-cols-3';
    case 2:
      return 'grid-cols-2 md:grid-cols-2';
    case 3:
      return 'grid-cols-2 md:grid-cols-3';
    default:
      return 'grid-cols-2 md:grid-cols-4';
  }
}

/** The image `sizes` hint that matches the columns a density produces. */
export function gridImageSizes(density: Density | null): string {
  switch (density) {
    case 1:
      return '(min-width: 1024px) 30vw, (min-width: 768px) 30vw, 92vw';
    case 2:
      return '(min-width: 768px) 46vw, 46vw';
    case 3:
      return '(min-width: 1024px) 30vw, (min-width: 768px) 30vw, 46vw';
    default:
      return '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw';
  }
}

// ---------------------------------------------------------------------------------------------
// Rows, filters, counts, sorting
// ---------------------------------------------------------------------------------------------

/** What filtering needs to know about a product. Built by the repository. */
export interface ListingRow {
  id: string;
  publishedAt: Date;
  featuredRank: number | null;
  /** Position inside a collection; 0 elsewhere. */
  position: number;
  /** Lowest active variant price in minor units. */
  minPriceMinor: bigint;
  fit: Fit | null;
  fabric: string | null;
  colors: Array<{ value: string; label: string; hex: string | null }>;
  sizes: string[];
}

export type FacetKey = 'size' | 'color' | 'fit' | 'fabric' | 'price' | 'inStock';

export interface PriceBoundsMinor {
  min: bigint | null;
  max: bigint | null;
}

/** Price filter in minor units, converted through lib/money (never floats). */
export function priceBoundsMinor(query: ListingQuery): PriceBoundsMinor {
  return {
    min: query.minPrice === null ? null : fromDecimalString(query.minPrice, CATALOG_CURRENCY).minor,
    max: query.maxPrice === null ? null : fromDecimalString(query.maxPrice, CATALOG_CURRENCY).minor,
  };
}

const intersects = (wanted: readonly string[], have: readonly string[]) =>
  wanted.length === 0 || wanted.some((value) => have.includes(value));

/**
 * The rows that pass the query, ignoring one facet when asked (that is how the count beside each
 * option is worked out: what would be left if this option were chosen as well).
 * `inStockIds` is null when the in-stock filter is off or stock is unknown.
 */
export function filterRows(
  rows: readonly ListingRow[],
  query: ListingQuery,
  inStockIds: ReadonlySet<string> | null,
  ignore?: FacetKey,
): ListingRow[] {
  const bounds = priceBoundsMinor(query);
  return rows.filter((row) => {
    if (ignore !== 'size' && !intersects(query.size, row.sizes)) return false;
    if (
      ignore !== 'color' &&
      !intersects(
        query.color,
        row.colors.map((c) => c.value),
      )
    ) {
      return false;
    }
    if (
      ignore !== 'fit' &&
      query.fit.length > 0 &&
      (row.fit === null || !query.fit.includes(row.fit))
    ) {
      return false;
    }
    if (
      ignore !== 'fabric' &&
      query.fabric.length > 0 &&
      (row.fabric === null || !query.fabric.includes(row.fabric))
    ) {
      return false;
    }
    if (ignore !== 'price') {
      if (bounds.min !== null && row.minPriceMinor < bounds.min) return false;
      if (bounds.max !== null && row.minPriceMinor > bounds.max) return false;
    }
    if (ignore !== 'inStock' && query.inStock && inStockIds && !inStockIds.has(row.id)) {
      return false;
    }
    return true;
  });
}

export type CollectionSortOrder = 'manual' | 'best_selling' | 'newest' | 'price_asc' | 'price_desc';

/** What "Featured" means for a page: the collection's own order, or the featured rank. */
export type DefaultOrder = 'featured' | 'position' | 'newest' | 'price-asc' | 'price-desc';

export function defaultOrderFor(sortOrder: CollectionSortOrder | null): DefaultOrder {
  switch (sortOrder) {
    case 'manual':
    case 'best_selling': // no sales data yet: the curated order stands in
      return 'position';
    case 'newest':
      return 'newest';
    case 'price_asc':
      return 'price-asc';
    case 'price_desc':
      return 'price-desc';
    default:
      return 'featured';
  }
}

const byId = (a: ListingRow, b: ListingRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const newestFirst = (a: ListingRow, b: ListingRow) =>
  b.publishedAt.getTime() - a.publishedAt.getTime() || byId(a, b);
const cmpBig = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

export function sortRows(
  rows: readonly ListingRow[],
  sort: ListingSort,
  defaultOrder: DefaultOrder,
): ListingRow[] {
  const effective: DefaultOrder = sort === 'featured' ? defaultOrder : sort;
  const copy = [...rows];
  switch (effective) {
    case 'newest':
      return copy.sort(newestFirst);
    case 'price-asc':
      return copy.sort((a, b) => cmpBig(a.minPriceMinor, b.minPriceMinor) || newestFirst(a, b));
    case 'price-desc':
      return copy.sort((a, b) => cmpBig(b.minPriceMinor, a.minPriceMinor) || newestFirst(a, b));
    case 'position':
      return copy.sort((a, b) => a.position - b.position || byId(a, b));
    default:
      // Featured rank first (lowest wins, unranked last), then newest.
      return copy.sort((a, b) => {
        const ar = a.featuredRank ?? Number.POSITIVE_INFINITY;
        const br = b.featuredRank ?? Number.POSITIVE_INFINITY;
        return ar === br ? newestFirst(a, b) : ar < br ? -1 : 1;
      });
  }
}

export function paginate<T>(items: readonly T[], page: number, pageSize = LISTING_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    totalPages,
    total: items.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------------------------

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  hex?: string | null;
}

export interface Facets {
  size: FacetOption[];
  color: FacetOption[];
  fit: FacetOption[];
  fabric: FacetOption[];
  /** Cheapest and dearest product price on the page, in whole currency units (decimal text). */
  priceRange: { min: string; max: string } | null;
  inStockCount: number;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function compareSizes(a: string, b: string): number {
  const ai = SIZE_ORDER.indexOf(a.toUpperCase());
  const bi = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  if (Number.isFinite(an)) return -1;
  if (Number.isFinite(bn)) return 1;
  return a.localeCompare(b);
}

interface Tally {
  label: string;
  count: number;
  hex?: string | null;
}

function tally(
  rows: readonly ListingRow[],
  pick: (row: ListingRow) => Array<{ value: string; label: string; hex?: string | null }>,
): Map<string, Tally> {
  const counts = new Map<string, Tally>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const entry of pick(row)) {
      if (seen.has(entry.value)) continue;
      seen.add(entry.value);
      const existing = counts.get(entry.value);
      if (existing) existing.count += 1;
      else counts.set(entry.value, { label: entry.label, count: 1, hex: entry.hex ?? null });
    }
  }
  return counts;
}

function options(
  counts: Map<string, Tally>,
  selected: readonly string[],
  order: (a: [string, Tally], b: [string, Tally]) => number,
): FacetOption[] {
  // A chosen value that nothing matches any more stays listed (count 0) so it can be un-chosen.
  for (const value of selected) {
    if (!counts.has(value)) counts.set(value, { label: value, count: 0 });
  }
  return [...counts.entries()].sort(order).map(([value, t]) => ({
    value,
    label: t.label,
    count: t.count,
    selected: selected.includes(value),
    ...(t.hex !== undefined ? { hex: t.hex } : {}),
  }));
}

const byCountThenLabel = (a: [string, Tally], b: [string, Tally]) =>
  b[1].count - a[1].count || a[1].label.localeCompare(b[1].label);

/**
 * Option lists with counts for the current page's products. Each facet is counted with every OTHER
 * filter applied, so choosing a second colour widens the result instead of showing zero.
 */
export function buildFacets(
  rows: readonly ListingRow[],
  query: ListingQuery,
  inStockIds: ReadonlySet<string> | null,
): Facets {
  const sizeRows = filterRows(rows, query, inStockIds, 'size');
  const colorRows = filterRows(rows, query, inStockIds, 'color');
  const fitRows = filterRows(rows, query, inStockIds, 'fit');
  const fabricRows = filterRows(rows, query, inStockIds, 'fabric');

  const sizes = options(
    tally(sizeRows, (r) => r.sizes.map((s) => ({ value: s, label: s }))),
    query.size,
    ([a], [b]) => compareSizes(a, b),
  );
  const colors = options(
    tally(colorRows, (r) => r.colors),
    query.color,
    byCountThenLabel,
  );
  const fits = options(
    tally(fitRows, (r) =>
      r.fit ? [{ value: r.fit, label: r.fit.charAt(0).toUpperCase() + r.fit.slice(1) }] : [],
    ),
    query.fit,
    ([a], [b]) => FIT_VALUES.indexOf(a as Fit) - FIT_VALUES.indexOf(b as Fit),
  );
  const fabrics = options(
    tally(fabricRows, (r) => (r.fabric ? [{ value: r.fabric, label: r.fabric }] : [])),
    query.fabric,
    byCountThenLabel,
  );

  let min: bigint | null = null;
  let max: bigint | null = null;
  for (const row of rows) {
    if (min === null || row.minPriceMinor < min) min = row.minPriceMinor;
    if (max === null || row.minPriceMinor > max) max = row.minPriceMinor;
  }

  return {
    size: sizes,
    color: colors,
    fit: fits,
    fabric: fabrics,
    priceRange: min !== null && max !== null ? { min: toMajor(min), max: toMajor(max) } : null,
    inStockCount: inStockIds ? rows.filter((r) => inStockIds.has(r.id)).length : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Search engine rules (ARCHITECTURE section 9)
// ---------------------------------------------------------------------------------------------

export interface ListingSeo {
  /** Path with query, relative to the site root. */
  canonical: string;
  index: boolean;
}

/**
 * Plain pages index themselves (page N too). One chosen colour or one chosen fit, alone, is a
 * landing page worth indexing and canonicalises to itself. Every other mix of filters, sort or
 * density points back at the base address and asks not to be indexed; links stay followable.
 */
export function listingSeo(basePath: string, query: ListingQuery): ListingSeo {
  const base: ListingSeo = { canonical: basePath, index: false };
  const cosmetic = query.sort !== 'featured' || query.density !== null;
  if (cosmetic || query.size.length > 0 || query.fabric.length > 0 || query.inStock) return base;
  if (query.minPrice !== null || query.maxPrice !== null) return base;

  const facets = query.color.length + query.fit.length;
  if (facets === 0) {
    return { canonical: listingHref(basePath, { ...EMPTY_QUERY, page: query.page }), index: true };
  }
  if (facets === 1 && query.page === 1) {
    return {
      canonical: listingHref(basePath, { ...EMPTY_QUERY, color: query.color, fit: query.fit }),
      index: true,
    };
  }
  if (facets === 1) {
    // A deep page of a facet: point at the facet's first page, do not index.
    return {
      canonical: listingHref(basePath, { ...EMPTY_QUERY, color: query.color, fit: query.fit }),
      index: false,
    };
  }
  return base;
}

/** Page links for a plain listing, for `rel` hints and the pagination component. */
export function pageLinks(basePath: string, query: ListingQuery, totalPages: number) {
  const href = (page: number) => listingHref(basePath, { ...query, page });
  return {
    href,
    prev: query.page > 1 ? href(Math.min(query.page - 1, totalPages)) : null,
    next: query.page < totalPages ? href(query.page + 1) : null,
  };
}

// ---------------------------------------------------------------------------------------------
// From database rows to listing rows
// ---------------------------------------------------------------------------------------------

/** The shape the repository's facet query returns (structurally; no database types here). */
export interface FacetSource {
  id: string;
  publishedAt: Date | null;
  featuredRank: number | null;
  fit: string | null;
  attributes: unknown;
  collections?: Array<{ position: number }>;
  variants: Array<{
    priceMinor: bigint;
    optionValues: Array<{
      optionValue: {
        value: string;
        label: string;
        swatchHex: string | null;
        option: { name: string };
      };
    }>;
  }>;
}

const isFit = (value: string | null): value is Fit =>
  value !== null && (FIT_VALUES as readonly string[]).includes(value);

export function toListingRow(source: FacetSource): ListingRow | null {
  if (source.variants.length === 0 || source.publishedAt === null) return null;
  const colors = new Map<string, { value: string; label: string; hex: string | null }>();
  const sizes = new Set<string>();
  let minPrice: bigint | null = null;
  for (const variant of source.variants) {
    if (minPrice === null || variant.priceMinor < minPrice) minPrice = variant.priceMinor;
    for (const { optionValue } of variant.optionValues) {
      const name = optionValue.option.name.trim();
      if (/^colou?rs?$/i.test(name)) {
        colors.set(optionValue.value, {
          value: optionValue.value,
          label: optionValue.label,
          hex: optionValue.swatchHex,
        });
      } else if (/^sizes?$/i.test(name)) {
        sizes.add(optionValue.label);
      }
    }
  }
  const fabric = (source.attributes as Record<string, unknown> | null)?.fabric;
  return {
    id: source.id,
    publishedAt: source.publishedAt,
    featuredRank: source.featuredRank,
    position: source.collections?.[0]?.position ?? 0,
    minPriceMinor: minPrice ?? 0n,
    fit: isFit(source.fit) ? source.fit : null,
    fabric: typeof fabric === 'string' && fabric.trim() !== '' ? fabric.trim() : null,
    colors: [...colors.values()],
    sizes: [...sizes],
  };
}
