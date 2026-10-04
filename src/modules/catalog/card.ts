import { format, money, serialize, type SerializedMoney } from '@/lib/money';

/**
 * What a product card needs, built from the rows the storefront queries read. Pure: no database,
 * no React. The card data is serialisable (money as strings), so it can be cached and sent to the
 * browser. Availability is NOT part of the cached data; it is merged in live (see applyAvailability).
 */

export interface CardImage {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  /** Dominant colour (hex) stored at upload, shown while the picture loads. */
  dominantColor?: string | null;
  /** Tiny base64 preview stored at upload, for next/image placeholders. */
  blurData?: string | null;
}

export interface CardColor {
  id: string;
  label: string;
  hex: string | null;
  image: CardImage | null;
  hoverImage: CardImage | null;
}

export interface CardVariant {
  id: string;
  colorId: string | null;
  size: string | null;
  /** Units that can be sold now; null until the live stock has been read. */
  available: number | null;
}

export type StockState = 'in' | 'low' | 'out';

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  price: SerializedMoney;
  compareAt: SerializedMoney | null;
  priceLabel: string;
  compareAtLabel: string | null;
  image: CardImage | null;
  hoverImage: CardImage | null;
  colors: CardColor[];
  /** Sizes in their stored order (union across colours). */
  sizes: string[];
  variants: CardVariant[];
  isNew: boolean;
  limited: boolean;
  /** Null while the live stock is unknown (the cached shell); never decided by the client. */
  stock: StockState | null;
}

/** The rows the card is built from (structurally what the repository selects). */
export interface CardSource {
  id: string;
  slug: string;
  title: string;
  publishedAt: Date | null;
  tags: string[];
  category: { name: string } | null;
  variants: Array<{
    id: string;
    priceMinor: bigint;
    compareAtMinor: bigint | null;
    currency: string;
    optionValues: Array<{
      optionValue: {
        id: string;
        label: string;
        value: string;
        swatchHex: string | null;
        position: number;
        option: { name: string };
      };
    }>;
  }>;
  media: Array<{
    url: string;
    alt: string;
    width: number | null;
    height: number | null;
    optionValueId: string | null;
    dominantColor: string | null;
    blurData: string | null;
  }>;
}

export const NEW_WINDOW_DAYS = 30;
export const LOW_STOCK_MAX = 3;
export const LIMITED_TAG = 'limited';

const DAY_MS = 86_400_000;

export const isNewProduct = (publishedAt: Date | null, now: Date): boolean =>
  publishedAt !== null &&
  now.getTime() - publishedAt.getTime() <= NEW_WINDOW_DAYS * DAY_MS &&
  publishedAt.getTime() <= now.getTime();

/** Sold out at none, low at 1 to 3 units across all sizes and colours, otherwise in stock. */
export function stockState(totalAvailable: number): StockState {
  if (totalAvailable <= 0) return 'out';
  return totalAvailable <= LOW_STOCK_MAX ? 'low' : 'in';
}

const isColorOption = (name: string) => /^colou?rs?$/i.test(name.trim());
const isSizeOption = (name: string) => /^sizes?$/i.test(name.trim());

const priceLabel = (minor: bigint, currency: string) =>
  format(money(minor, currency), { trimZeroFraction: true });

const toImage = (m: CardSource['media'][number]): CardImage => ({
  url: m.url,
  alt: m.alt,
  width: m.width,
  height: m.height,
  dominantColor: m.dominantColor,
  blurData: m.blurData,
});

/**
 * One card from a product row, or null when it has no sellable variant. The price is the lowest
 * active variant price. Pictures follow the colours: each colour has its own first and second image
 * (falling back to the product's general images), and the default is the first picture overall.
 */
export function toCard(source: CardSource, now: Date = new Date()): ProductCardData | null {
  // Cheapest variant first, so its price is the "from" price.
  const variants = [...source.variants].sort((a, b) =>
    a.priceMinor < b.priceMinor ? -1 : a.priceMinor > b.priceMinor ? 1 : 0,
  );
  const cheapest = variants[0];
  if (!cheapest) return null;

  const compareAt =
    cheapest.compareAtMinor && cheapest.compareAtMinor > cheapest.priceMinor
      ? cheapest.compareAtMinor
      : null;

  const colorValues = new Map<
    string,
    { id: string; label: string; hex: string | null; position: number }
  >();
  const sizeValues = new Map<string, number>();
  const cardVariants: CardVariant[] = [];
  for (const variant of source.variants) {
    let colorId: string | null = null;
    let size: string | null = null;
    for (const { optionValue } of variant.optionValues) {
      if (isColorOption(optionValue.option.name)) {
        colorId = optionValue.id;
        if (!colorValues.has(optionValue.id)) {
          colorValues.set(optionValue.id, {
            id: optionValue.id,
            label: optionValue.label,
            hex: optionValue.swatchHex,
            position: optionValue.position,
          });
        }
      } else if (isSizeOption(optionValue.option.name)) {
        size = optionValue.label;
        if (!sizeValues.has(size)) sizeValues.set(size, optionValue.position);
      }
    }
    cardVariants.push({ id: variant.id, colorId, size, available: null });
  }

  const media = source.media;
  const general = media.filter((m) => m.optionValueId === null);
  const first = media[0] ?? null;

  const colors = [...colorValues.values()]
    .sort((a, b) => a.position - b.position)
    .map((color): CardColor => {
      const own = media.filter((m) => m.optionValueId === color.id);
      const pool = own.length > 0 ? own : general;
      return {
        id: color.id,
        label: color.label,
        hex: color.hex,
        image: pool[0] ? toImage(pool[0]) : first ? toImage(first) : null,
        hoverImage: pool[1] ? toImage(pool[1]) : null,
      };
    });

  // Default pictures: the first picture, and the next one of the same colour.
  const firstOwn = first?.optionValueId
    ? media.filter((m) => m.optionValueId === first.optionValueId)
    : media;
  const hover = firstOwn[1] ?? media[1] ?? null;

  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    categoryName: source.category?.name ?? null,
    price: serialize(money(cheapest.priceMinor, cheapest.currency)),
    compareAt: compareAt === null ? null : serialize(money(compareAt, cheapest.currency)),
    priceLabel: priceLabel(cheapest.priceMinor, cheapest.currency),
    compareAtLabel: compareAt === null ? null : priceLabel(compareAt, cheapest.currency),
    image: first ? toImage(first) : null,
    hoverImage: hover ? toImage(hover) : null,
    colors,
    sizes: [...sizeValues.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label),
    variants: cardVariants,
    isNew: isNewProduct(source.publishedAt, now),
    limited: source.tags.includes(LIMITED_TAG),
    stock: null,
  };
}

/** The part of the inventory answer a card needs. */
export interface AvailabilityLike {
  available: number;
}

/**
 * Merges live stock into a card: per-variant units (so the size row knows what is in stock) and the
 * badge state. A variant the inventory has no row for counts as sold out.
 */
export function applyAvailability(
  card: ProductCardData,
  availability: ReadonlyMap<string, AvailabilityLike>,
): ProductCardData {
  let total = 0;
  const variants = card.variants.map((variant) => {
    const available = Math.max(0, availability.get(variant.id)?.available ?? 0);
    total += available;
    return { ...variant, available };
  });
  return { ...card, variants, stock: stockState(total) };
}

export const variantIdsOf = (cards: readonly ProductCardData[]): string[] =>
  cards.flatMap((card) => card.variants.map((variant) => variant.id));

export interface CardBadge {
  key: 'sold-out' | 'low-stock' | 'limited' | 'new';
  label: string;
}

/**
 * Badges for a card, most important first and at most two: Sold out, Low stock, Limited (only for
 * products tagged `limited`), New (published in the last 30 days). Stock badges need the live
 * stock; without it (null) only New and Limited can show.
 */
export function cardBadges(card: {
  stock?: StockState | null;
  isNew?: boolean;
  limited?: boolean;
}): CardBadge[] {
  const badges: CardBadge[] = [];
  if (card.stock === 'out') badges.push({ key: 'sold-out', label: 'Sold out' });
  else if (card.stock === 'low') badges.push({ key: 'low-stock', label: 'Low stock' });
  if (card.limited) badges.push({ key: 'limited', label: 'Limited' });
  if (card.isNew) badges.push({ key: 'new', label: 'New' });
  return badges.slice(0, 2);
}
