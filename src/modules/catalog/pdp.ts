import { format, money, serialize, type SerializedMoney } from '@/lib/money';

/**
 * The product page, built from the rows the storefront reads. Pure: no database, no React. Everything
 * here is cacheable shell data (title, pictures, options, size chart). Price and stock are NOT part
 * of it: they are read live next to the shell (see LivePrice and the inventory service), so a stock
 * change never needs the shell to be rebuilt, and the browser never decides either.
 */

export interface PdpImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  blurData: string | null;
  /** The colour this picture belongs to, or null for general pictures. */
  colorId: string | null;
}

export interface PdpColor {
  id: string;
  label: string;
  hex: string | null;
}

export interface PdpSize {
  id: string;
  label: string;
}

export interface PdpVariant {
  id: string;
  sku: string;
  colorId: string | null;
  sizeId: string | null;
}

export interface PdpSizeChart {
  name: string;
  unit: 'cm' | 'in';
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
  howToMeasure: string | null;
  modelInfo: string | null;
}

export interface PdpCrumb {
  name: string;
  href: string;
}

export interface PdpData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  /** Description split into paragraphs; rendered as plain text, never as HTML. */
  description: string[];
  /** Collection or category shown above the title. */
  eyebrow: string | null;
  breadcrumb: PdpCrumb[];
  details: Array<{ label: string; value: string }>;
  care: string | null;
  fit: string | null;
  fabric: string | null;
  colors: PdpColor[];
  sizes: PdpSize[];
  variants: PdpVariant[];
  images: PdpImage[];
  sizeChart: PdpSizeChart | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  currency: string;
  categoryId: string | null;
}

export interface PdpSource {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  material: string | null;
  careInstructions: string | null;
  fit: string | null;
  origin: string | null;
  attributes: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  categoryId: string | null;
  category: { name: string; path: string } | null;
  options: Array<{
    id: string;
    name: string;
    position: number;
    values: Array<{
      id: string;
      label: string;
      swatchHex: string | null;
      position: number;
    }>;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    currency: string;
    position: number;
    optionValues: Array<{ optionValueId: string }>;
  }>;
  media: Array<{
    id: string;
    url: string;
    alt: string;
    width: number | null;
    height: number | null;
    dominantColor: string | null;
    blurData: string | null;
    optionValueId: string | null;
    type: string;
  }>;
  sizeChart: {
    name: string;
    unit: string;
    table: unknown;
    howToMeasure: string | null;
    modelInfo: string | null;
  } | null;
}

const isColorOption = (name: string) => /^colou?rs?$/i.test(name.trim());
const isSizeOption = (name: string) => /^sizes?$/i.test(name.trim());

const FIT_LABEL: Record<string, string> = {
  slim: 'Slim fit',
  regular: 'Regular fit',
  relaxed: 'Relaxed fit',
};

export function paragraphs(text: string | null): string[] {
  return (text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function readSizeChart(source: PdpSource['sizeChart']): PdpSizeChart | null {
  if (!source) return null;
  const table = source.table as { columns?: unknown; rows?: unknown } | null;
  const columns = Array.isArray(table?.columns) ? table.columns.map(String) : [];
  const rows = Array.isArray(table?.rows)
    ? (table.rows as Array<{ size?: unknown; values?: unknown }>).map((row) => ({
        size: String(row.size ?? ''),
        values: Array.isArray(row.values) ? row.values.map(String) : [],
      }))
    : [];
  if (columns.length === 0 || rows.length === 0) return null;
  return {
    name: source.name,
    unit: source.unit === 'in' ? 'in' : 'cm',
    columns,
    rows,
    howToMeasure: source.howToMeasure,
    modelInfo: source.modelInfo,
  };
}

export function buildPdp(
  source: PdpSource,
  extras: { eyebrow: string | null; categoryTrail: PdpCrumb[] },
): PdpData {
  const colorOption = source.options.find((option) => isColorOption(option.name));
  const sizeOption = source.options.find((option) => isSizeOption(option.name));
  const byPosition = <T extends { position: number }>(items: T[]) =>
    [...items].sort((a, b) => a.position - b.position);

  const colors: PdpColor[] = byPosition(colorOption?.values ?? []).map((value) => ({
    id: value.id,
    label: value.label,
    hex: value.swatchHex,
  }));
  const sizes: PdpSize[] = byPosition(sizeOption?.values ?? []).map((value) => ({
    id: value.id,
    label: value.label,
  }));
  const colorIds = new Set(colors.map((color) => color.id));
  const sizeIds = new Set(sizes.map((size) => size.id));

  const variants: PdpVariant[] = byPosition(source.variants).map((variant) => {
    const ids = variant.optionValues.map((entry) => entry.optionValueId);
    return {
      id: variant.id,
      sku: variant.sku,
      colorId: ids.find((id) => colorIds.has(id)) ?? null,
      sizeId: ids.find((id) => sizeIds.has(id)) ?? null,
    };
  });

  const attributes = (source.attributes ?? {}) as Record<string, unknown>;
  const fabric = typeof attributes.fabric === 'string' ? attributes.fabric : null;
  const details = [
    { label: 'Fit', value: source.fit ? (FIT_LABEL[source.fit] ?? source.fit) : '' },
    { label: 'Fabric', value: fabric ?? '' },
    { label: 'Material', value: source.material ?? '' },
    { label: 'Origin', value: source.origin ?? '' },
  ].filter((entry) => entry.value);

  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    subtitle: source.subtitle,
    description: paragraphs(source.description),
    eyebrow: extras.eyebrow,
    breadcrumb: [
      { name: 'Shop', href: '/shop' },
      ...extras.categoryTrail,
      { name: source.title, href: `/products/${source.slug}` },
    ],
    details,
    care: source.careInstructions,
    fit: source.fit ? (FIT_LABEL[source.fit] ?? source.fit) : null,
    fabric,
    colors,
    sizes,
    variants,
    images: source.media
      .filter((media) => media.type === 'image')
      .map((media) => ({
        id: media.id,
        url: media.url,
        alt: media.alt,
        width: media.width,
        height: media.height,
        dominantColor: media.dominantColor,
        blurData: media.blurData,
        colorId:
          media.optionValueId && colorIds.has(media.optionValueId) ? media.optionValueId : null,
      })),
    sizeChart: readSizeChart(source.sizeChart),
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    publishedAt: source.publishedAt?.toISOString() ?? null,
    currency: source.variants[0]?.currency ?? 'BDT',
    categoryId: source.categoryId,
  };
}

// ---------------------------------------------------------------------------------------------
// Live price and stock (never cached)
// ---------------------------------------------------------------------------------------------

export interface LiveVariant {
  id: string;
  price: SerializedMoney;
  priceLabel: string;
  compareAt: SerializedMoney | null;
  compareAtLabel: string | null;
  /** Units that can be sold right now (on hand minus reserved), from the inventory service. */
  available: number;
}

export interface LivePrice {
  variants: LiveVariant[];
  /** Lowest active price, for the heading and the sticky bar. */
  from: { label: string; compareAtLabel: string | null } | null;
}

const label = (minor: bigint, currency: string) =>
  format(money(minor, currency), { trimZeroFraction: true });

export function buildLive(
  rows: ReadonlyArray<{
    id: string;
    priceMinor: bigint;
    compareAtMinor: bigint | null;
    currency: string;
  }>,
  availability: ReadonlyMap<string, { available: number }>,
): LivePrice {
  const variants = rows.map<LiveVariant>((row) => {
    const compareAt =
      row.compareAtMinor !== null && row.compareAtMinor > row.priceMinor
        ? row.compareAtMinor
        : null;
    return {
      id: row.id,
      price: serialize(money(row.priceMinor, row.currency)),
      priceLabel: label(row.priceMinor, row.currency),
      compareAt: compareAt === null ? null : serialize(money(compareAt, row.currency)),
      compareAtLabel: compareAt === null ? null : label(compareAt, row.currency),
      available: Math.max(0, availability.get(row.id)?.available ?? 0),
    };
  });
  const cheapest = [...rows].sort((a, b) => (a.priceMinor < b.priceMinor ? -1 : 1))[0];
  return {
    variants,
    from: cheapest
      ? {
          label: label(cheapest.priceMinor, cheapest.currency),
          compareAtLabel:
            cheapest.compareAtMinor !== null && cheapest.compareAtMinor > cheapest.priceMinor
              ? label(cheapest.compareAtMinor, cheapest.currency)
              : null,
        }
      : null,
  };
}

/** How a size or a whole product reads at a glance. Sold out, low (1 to 3 left) or in stock. */
export type SizeState = 'in' | 'low' | 'out';

export const LOW_STOCK_LIMIT = 3;

export const sizeState = (available: number): SizeState =>
  available <= 0 ? 'out' : available <= LOW_STOCK_LIMIT ? 'low' : 'in';
