import { describe, expect, it } from 'vitest';
import { buildLive, buildPdp, paragraphs, sizeState, type PdpSource } from '../pdp';

const source = (overrides: Partial<PdpSource> = {}): PdpSource => ({
  id: 'p1',
  slug: 'oxford-shirt',
  title: 'Oxford Shirt',
  subtitle: 'Brushed cotton',
  description: 'First paragraph.\n\nSecond   paragraph\nwraps.',
  material: '100% cotton',
  careInstructions: 'Machine wash cold.',
  fit: 'slim',
  origin: 'Bangladesh',
  attributes: { fabric: 'Egyptian cotton' },
  seoTitle: null,
  seoDescription: null,
  publishedAt: new Date('2026-09-01T00:00:00Z'),
  categoryId: 'c1',
  category: { name: 'Shirts', path: 'shirts' },
  options: [
    {
      id: 'o-size',
      name: 'Size',
      position: 1,
      values: [
        { id: 's-m', label: 'M', swatchHex: null, position: 1 },
        { id: 's-s', label: 'S', swatchHex: null, position: 0 },
      ],
    },
    {
      id: 'o-color',
      name: 'Color',
      position: 0,
      values: [
        { id: 'c-white', label: 'White', swatchHex: '#F8F8F6', position: 0 },
        { id: 'c-navy', label: 'Navy', swatchHex: '#1F2A44', position: 1 },
      ],
    },
  ],
  variants: [
    {
      id: 'v1',
      sku: 'OX-W-S',
      currency: 'BDT',
      position: 0,
      optionValues: [{ optionValueId: 'c-white' }, { optionValueId: 's-s' }],
    },
    {
      id: 'v2',
      sku: 'OX-W-M',
      currency: 'BDT',
      position: 1,
      optionValues: [{ optionValueId: 'c-white' }, { optionValueId: 's-m' }],
    },
    {
      id: 'v3',
      sku: 'OX-N-S',
      currency: 'BDT',
      position: 2,
      optionValues: [{ optionValueId: 'c-navy' }, { optionValueId: 's-s' }],
    },
  ],
  media: [
    {
      id: 'm1',
      url: '/a.jpg',
      alt: 'White front',
      width: 800,
      height: 1000,
      dominantColor: '#fff',
      blurData: null,
      optionValueId: 'c-white',
      type: 'image',
    },
    {
      id: 'm2',
      url: '/b.jpg',
      alt: 'Detail',
      width: 800,
      height: 1000,
      dominantColor: null,
      blurData: null,
      optionValueId: null,
      type: 'image',
    },
    {
      id: 'm3',
      url: '/c.mp4',
      alt: 'Clip',
      width: null,
      height: null,
      dominantColor: null,
      blurData: null,
      optionValueId: null,
      type: 'video',
    },
  ],
  sizeChart: {
    name: 'Shirts',
    unit: 'cm',
    table: { columns: ['Chest', 'Waist'], rows: [{ size: 'S', values: ['96', '82'] }] },
    howToMeasure: null,
    modelInfo: 'Model is 183 cm, wears M',
  },
  ...overrides,
});

describe('product page data', () => {
  const pdp = buildPdp(source(), {
    eyebrow: 'Autumn',
    categoryTrail: [{ name: 'Shirts', href: '/shop/shirts' }],
  });

  it('orders colours and sizes by position and maps variants to them', () => {
    expect(pdp.colors.map((c) => c.label)).toEqual(['White', 'Navy']);
    expect(pdp.sizes.map((s) => s.label)).toEqual(['S', 'M']);
    expect(pdp.variants.map((v) => [v.sku, v.colorId, v.sizeId])).toEqual([
      ['OX-W-S', 'c-white', 's-s'],
      ['OX-W-M', 'c-white', 's-m'],
      ['OX-N-S', 'c-navy', 's-s'],
    ]);
  });

  it('keeps pictures only, tied to their colour, with alt text', () => {
    expect(pdp.images.map((i) => [i.id, i.colorId, i.alt])).toEqual([
      ['m1', 'c-white', 'White front'],
      ['m2', null, 'Detail'],
    ]);
  });

  it('splits the description into paragraphs and never keeps markup as HTML', () => {
    expect(pdp.description).toEqual(['First paragraph.', 'Second paragraph wraps.']);
    expect(paragraphs(null)).toEqual([]);
  });

  it('builds the breadcrumb and the detail rows', () => {
    expect(pdp.breadcrumb.map((c) => c.href)).toEqual([
      '/shop',
      '/shop/shirts',
      '/products/oxford-shirt',
    ]);
    expect(pdp.details).toEqual([
      { label: 'Fit', value: 'Slim fit' },
      { label: 'Fabric', value: 'Egyptian cotton' },
      { label: 'Material', value: '100% cotton' },
      { label: 'Origin', value: 'Bangladesh' },
    ]);
    expect(pdp.sizeChart?.rows[0]?.values).toEqual(['96', '82']);
  });

  it('has no size chart when the table is empty', () => {
    const none = buildPdp(
      source({
        sizeChart: { name: 'x', unit: 'cm', table: {}, howToMeasure: null, modelInfo: null },
      }),
      {
        eyebrow: null,
        categoryTrail: [],
      },
    );
    expect(none.sizeChart).toBeNull();
  });
});

describe('live price and stock', () => {
  const rows = [
    { id: 'v1', priceMinor: 329000n, compareAtMinor: 399000n, currency: 'BDT' },
    { id: 'v2', priceMinor: 349000n, compareAtMinor: null, currency: 'BDT' },
    { id: 'v3', priceMinor: 329000n, compareAtMinor: 300000n, currency: 'BDT' },
  ];

  it('reads units from the inventory and never goes negative', () => {
    const live = buildLive(
      rows,
      new Map([
        ['v1', { available: 2 }],
        ['v2', { available: -4 }],
      ]),
    );
    expect(live.variants.map((v) => v.available)).toEqual([2, 0, 0]);
  });

  it('shows a compare-at price only when it is higher than the price', () => {
    const live = buildLive(rows, new Map());
    expect(live.variants[0]?.compareAtLabel).toBeTruthy();
    expect(live.variants[1]?.compareAtLabel).toBeNull();
    expect(live.variants[2]?.compareAtLabel).toBeNull();
    expect(live.from?.label).toBe(live.variants[0]?.priceLabel);
  });

  it('classifies stock: sold out, low (1 to 3) and in stock', () => {
    expect(sizeState(0)).toBe('out');
    expect(sizeState(1)).toBe('low');
    expect(sizeState(3)).toBe('low');
    expect(sizeState(4)).toBe('in');
  });
});
