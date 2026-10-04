import { describe, expect, it } from 'vitest';
import type { LiveVariant, PdpColor, PdpSize, PdpVariant } from '@/modules/catalog/pdp';
import {
  blockReason,
  colorSoldOut,
  maxQuantity,
  resolveVariant,
  sizeOptions,
  stockNote,
} from '../buy-logic';

const colors: PdpColor[] = [
  { id: 'white', label: 'White', hex: '#fff' },
  { id: 'navy', label: 'Navy', hex: '#123' },
];
const sizes: PdpSize[] = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
];
const variants: PdpVariant[] = [
  { id: 'w-s', sku: 'W-S', colorId: 'white', sizeId: 's' },
  { id: 'w-m', sku: 'W-M', colorId: 'white', sizeId: 'm' },
  { id: 'w-l', sku: 'W-L', colorId: 'white', sizeId: 'l' },
  { id: 'n-s', sku: 'N-S', colorId: 'navy', sizeId: 's' },
  { id: 'n-m', sku: 'N-M', colorId: 'navy', sizeId: 'm' },
];
const live = (units: Record<string, number>) =>
  new Map<string, LiveVariant>(
    variants.map((v) => [
      v.id,
      {
        id: v.id,
        price: { minor: '329000', currency: 'BDT' },
        priceLabel: '3,290',
        compareAt: null,
        compareAtLabel: null,
        available: units[v.id] ?? 0,
      },
    ]),
  );

describe('size selector states', () => {
  const stock = live({ 'w-s': 12, 'w-m': 2, 'w-l': 0, 'n-s': 0, 'n-m': 0 });

  it('marks each size in stock, low (1 to 3) or sold out for the chosen colour', () => {
    const options = sizeOptions(sizes, variants, stock, 'white');
    expect(options.map((o) => [o.label, o.state, o.available])).toEqual([
      ['S', 'in', 12],
      ['M', 'low', 2],
      ['L', 'out', 0],
    ]);
  });

  it('a size that does not exist in a colour is sold out there', () => {
    const options = sizeOptions(sizes, variants, stock, 'navy');
    expect(options.find((o) => o.label === 'L')).toMatchObject({ variantId: null, state: 'out' });
  });

  it('writes the note under the chosen size', () => {
    const options = sizeOptions(sizes, variants, stock, 'white');
    expect(stockNote(options[1])).toBe('Only 2 left.');
    expect(stockNote(options[2])).toBe('Sold out in this size.');
    expect(stockNote(options[0])).toBeNull();
    expect(stockNote(undefined)).toBeNull();
  });

  it('a colour with nothing left shows as sold out', () => {
    expect(colorSoldOut(colors[1]!, variants, stock)).toBe(true);
    expect(colorSoldOut(colors[0]!, variants, stock)).toBe(false);
  });

  it('resolves the variant for a colour and size', () => {
    expect(resolveVariant(variants, 'white', 'm')?.id).toBe('w-m');
    expect(resolveVariant(variants, 'navy', 'l')).toBeNull();
  });
});

describe('add to bag rules', () => {
  it('asks for a size first, then lets an available size through', () => {
    expect(
      blockReason({
        hasSizes: true,
        sizeChosen: false,
        variantAvailable: null,
        anyAvailable: true,
      }),
    ).toBe('choose-size');
    expect(
      blockReason({ hasSizes: true, sizeChosen: true, variantAvailable: 5, anyAvailable: true }),
    ).toBeNull();
  });

  it('blocks a sold-out size and a sold-out product', () => {
    expect(
      blockReason({ hasSizes: true, sizeChosen: true, variantAvailable: 0, anyAvailable: true }),
    ).toBe('sold-out');
    expect(
      blockReason({
        hasSizes: true,
        sizeChosen: false,
        variantAvailable: null,
        anyAvailable: false,
      }),
    ).toBe('sold-out');
  });

  it('a product without sizes follows the colour it is showing', () => {
    expect(
      blockReason({ hasSizes: false, sizeChosen: false, variantAvailable: 0, anyAvailable: true }),
    ).toBe('sold-out');
    expect(
      blockReason({ hasSizes: false, sizeChosen: false, variantAvailable: 4, anyAvailable: true }),
    ).toBeNull();
  });

  it('caps the quantity at ten and at what is available', () => {
    expect(maxQuantity(25)).toBe(10);
    expect(maxQuantity(3)).toBe(3);
    expect(maxQuantity(0)).toBe(0);
  });
});
