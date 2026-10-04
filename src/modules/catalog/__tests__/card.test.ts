import { describe, expect, it } from 'vitest';
import {
  applyAvailability,
  cardBadges,
  isNewProduct,
  stockState,
  toCard,
  variantIdsOf,
  type CardSource,
} from '../card';

const NOW = new Date('2026-10-04T12:00:00Z');
const day = 86_400_000;

const colorValue = (id: string, label: string, position: number, hex: string | null = '#fff') => ({
  id,
  label,
  value: label.toLowerCase(),
  swatchHex: hex,
  position,
  option: { name: 'Color' },
});
const sizeValue = (id: string, label: string, position: number) => ({
  id,
  label,
  value: label.toLowerCase(),
  swatchHex: null,
  position,
  option: { name: 'Size' },
});

const white = colorValue('c-white', 'White', 0);
const navy = colorValue('c-navy', 'Navy', 1, '#1F2A44');
const sizeM = sizeValue('s-m', 'M', 1);
const sizeS = sizeValue('s-s', 'S', 0);

const media = (url: string, optionValueId: string | null) => ({
  url,
  alt: `alt ${url}`,
  width: 800,
  height: 1000,
  optionValueId,
  dominantColor: '#aaaaaa',
  blurData: null,
});

const source = (overrides: Partial<CardSource> = {}): CardSource => ({
  id: 'p1',
  slug: 'oxford-shirt',
  title: 'Oxford shirt',
  publishedAt: new Date(NOW.getTime() - 5 * day),
  tags: ['shirts'],
  category: { name: 'Shirts' },
  variants: [
    {
      id: 'v-white-m',
      priceMinor: 249000n,
      compareAtMinor: 299000n,
      currency: 'BDT',
      optionValues: [{ optionValue: white }, { optionValue: sizeM }],
    },
    {
      id: 'v-white-s',
      priceMinor: 249000n,
      compareAtMinor: null,
      currency: 'BDT',
      optionValues: [{ optionValue: white }, { optionValue: sizeS }],
    },
    {
      id: 'v-navy-m',
      priceMinor: 219000n,
      compareAtMinor: 219000n,
      currency: 'BDT',
      optionValues: [{ optionValue: navy }, { optionValue: sizeM }],
    },
  ],
  media: [
    media('/seed/white-front.svg', 'c-white'),
    media('/seed/white-detail.svg', 'c-white'),
    media('/seed/navy-front.svg', 'c-navy'),
    media('/seed/navy-detail.svg', 'c-navy'),
  ],
  ...overrides,
});

describe('toCard', () => {
  it('uses the lowest active variant price and shows compare-at only when it is higher', () => {
    const card = toCard(source(), NOW)!;
    // The navy variant is cheapest and its compare-at equals the price: not reduced.
    expect(card.price).toEqual({ minor: '219000', currency: 'BDT' });
    expect(card.compareAt).toBeNull();
    expect(card.priceLabel).toContain('2,190');

    const reduced = toCard(
      source({
        variants: [
          {
            id: 'v1',
            priceMinor: 199000n,
            compareAtMinor: 249000n,
            currency: 'BDT',
            optionValues: [],
          },
        ],
      }),
      NOW,
    )!;
    expect(reduced.compareAt).toEqual({ minor: '249000', currency: 'BDT' });
    expect(reduced.compareAtLabel).toContain('2,490');
  });

  it('returns null when nothing can be sold', () => {
    expect(toCard(source({ variants: [] }), NOW)).toBeNull();
  });

  it('lists colours in stored order, each with its own pictures', () => {
    const card = toCard(source(), NOW)!;
    expect(card.colors.map((c) => c.label)).toEqual(['White', 'Navy']);
    expect(card.colors[1]?.image?.url).toBe('/seed/navy-front.svg');
    expect(card.colors[1]?.hoverImage?.url).toBe('/seed/navy-detail.svg');
    expect(card.colors[0]?.hex).toBe('#fff');
  });

  it('defaults to the first picture and the next picture of the same colour', () => {
    const card = toCard(source(), NOW)!;
    expect(card.image?.url).toBe('/seed/white-front.svg');
    expect(card.hoverImage?.url).toBe('/seed/white-detail.svg');
    expect(card.image?.dominantColor).toBe('#aaaaaa');
  });

  it('falls back to general pictures for a colour without its own', () => {
    const card = toCard(
      source({ media: [media('/seed/general-1.svg', null), media('/seed/general-2.svg', null)] }),
      NOW,
    )!;
    expect(card.colors.every((c) => c.image?.url === '/seed/general-1.svg')).toBe(true);
    expect(card.colors[0]?.hoverImage?.url).toBe('/seed/general-2.svg');
  });

  it('has no image when the product has no media', () => {
    const card = toCard(source({ media: [] }), NOW)!;
    expect(card.image).toBeNull();
    expect(card.hoverImage).toBeNull();
    expect(card.colors.every((c) => c.image === null)).toBe(true);
  });

  it('orders sizes by their stored position and maps variants to colour and size', () => {
    const card = toCard(source(), NOW)!;
    expect(card.sizes).toEqual(['S', 'M']);
    expect(card.variants).toEqual([
      { id: 'v-white-m', colorId: 'c-white', size: 'M', available: null },
      { id: 'v-white-s', colorId: 'c-white', size: 'S', available: null },
      { id: 'v-navy-m', colorId: 'c-navy', size: 'M', available: null },
    ]);
    expect(variantIdsOf([card])).toEqual(['v-white-m', 'v-white-s', 'v-navy-m']);
  });

  it('flags new and limited products and leaves stock unknown', () => {
    const card = toCard(source({ tags: ['limited'] }), NOW)!;
    expect(card.isNew).toBe(true);
    expect(card.limited).toBe(true);
    expect(card.stock).toBeNull();
    expect(toCard(source({ publishedAt: new Date(NOW.getTime() - 45 * day) }), NOW)!.isNew).toBe(
      false,
    );
  });
});

describe('isNewProduct', () => {
  it('is true for the last 30 days only, never for the future or unpublished', () => {
    expect(isNewProduct(new Date(NOW.getTime() - 29 * day), NOW)).toBe(true);
    expect(isNewProduct(new Date(NOW.getTime() - 30 * day), NOW)).toBe(true);
    expect(isNewProduct(new Date(NOW.getTime() - 31 * day), NOW)).toBe(false);
    expect(isNewProduct(new Date(NOW.getTime() + day), NOW)).toBe(false);
    expect(isNewProduct(null, NOW)).toBe(false);
  });
});

describe('stock state', () => {
  it('is out at zero, low from one to three, otherwise in stock', () => {
    expect(stockState(0)).toBe('out');
    expect(stockState(-2)).toBe('out');
    expect(stockState(1)).toBe('low');
    expect(stockState(3)).toBe('low');
    expect(stockState(4)).toBe('in');
  });

  it('merges live availability into a card, counting unknown variants as sold out', () => {
    const card = toCard(source(), NOW)!;
    const stocked = applyAvailability(
      card,
      new Map([
        ['v-white-m', { available: 2 }],
        ['v-navy-m', { available: 1 }],
      ]),
    );
    expect(stocked.variants.map((v) => v.available)).toEqual([2, 0, 1]);
    expect(stocked.stock).toBe('low');

    expect(applyAvailability(card, new Map()).stock).toBe('out');
    expect(applyAvailability(card, new Map([['v-white-s', { available: 40 }]])).stock).toBe('in');
    // The input is not changed.
    expect(card.stock).toBeNull();
  });
});

describe('cardBadges', () => {
  it('shows sold out before low stock, then limited, then new, two at most', () => {
    expect(cardBadges({ stock: 'out', isNew: true, limited: true }).map((b) => b.key)).toEqual([
      'sold-out',
      'limited',
    ]);
    expect(cardBadges({ stock: 'low', isNew: true }).map((b) => b.label)).toEqual([
      'Low stock',
      'New',
    ]);
    expect(cardBadges({ stock: 'in', isNew: true }).map((b) => b.label)).toEqual(['New']);
    expect(cardBadges({ stock: null, isNew: false, limited: false })).toEqual([]);
  });

  it('only shows Limited for products that carry the limited tag', () => {
    expect(cardBadges({ stock: 'in', limited: false }).some((b) => b.key === 'limited')).toBe(
      false,
    );
  });
});
