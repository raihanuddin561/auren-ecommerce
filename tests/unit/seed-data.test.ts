import { describe, expect, it } from 'vitest';
import { newId } from '@/lib/ids';
import {
  CATEGORIES,
  COLORS,
  PRODUCTS,
  SIZES,
  buildCatalogSeed,
  stockFor,
} from '../../prisma/seed-data';

const rows = buildCatalogSeed(newId, new Date('2026-10-01T00:00:00Z'));

describe('development catalog seed', () => {
  it('has 6 categories and 40 products spread across them', () => {
    expect(rows.categories).toHaveLength(6);
    expect(rows.products).toHaveLength(40);
    const perCategory = CATEGORIES.map((c) => PRODUCTS.filter((p) => p.category === c.slug).length);
    expect(perCategory.every((count) => count >= 6)).toBe(true);
    expect(perCategory.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('uses unique slugs, SKUs and category paths', () => {
    const unique = (values: unknown[]) => new Set(values).size === values.length;
    expect(unique(rows.products.map((p) => p.slug))).toBe(true);
    expect(unique(rows.variants.map((v) => v.sku))).toBe(true);
    expect(unique(rows.categories.map((c) => c.path))).toBe(true);
    expect(unique([...rows.categories, ...rows.products].map((r) => r.id))).toBe(true);
  });

  it('gives every product colour and size options and a full variant matrix', () => {
    for (const def of PRODUCTS) {
      const variants = rows.variants.filter(
        (v) => v.productId === rows.products.find((p) => p.slug === def.slug)?.id,
      );
      expect(variants).toHaveLength(def.colors.length * SIZES[def.sizes].length);
      expect(variants.filter((v) => v.isDefault)).toHaveLength(1);
    }
    expect(rows.options).toHaveLength(80);
    expect(rows.variantOptionValues).toHaveLength(rows.variants.length * 2);
  });

  it('keeps prices in integer minor units with a positive margin and valid markdowns', () => {
    for (const variant of rows.variants) {
      const price = variant.priceMinor as bigint;
      const cost = variant.avgCostMinor as bigint;
      expect(typeof price).toBe('bigint');
      expect(price % 100n).toBe(0n); // whole taka
      expect(cost).toBeGreaterThan(0n);
      expect(cost).toBeLessThan(price);
      if (variant.compareAtMinor !== null && variant.compareAtMinor !== undefined)
        expect(variant.compareAtMinor as bigint).toBeGreaterThan(price);
      expect(variant.currency).toBe('BDT');
    }
    expect(
      rows.variants.some((v) => v.compareAtMinor !== null && v.compareAtMinor !== undefined),
    ).toBe(true);
  });

  it('prices a shirt at exactly 3,290 taka', () => {
    const oxford = rows.variants.find((v) => String(v.sku).startsWith('AUR-OXFBUTDOW-WHITE'));
    expect(oxford?.priceMinor).toBe(329000n);
    expect(oxford?.avgCostMinor).toBe(138180n); // 42% of the price
  });

  it('has descriptive alt text and 4:5 images for every colour', () => {
    expect(rows.media.length).toBeGreaterThanOrEqual(80);
    for (const media of rows.media) {
      expect(String(media.alt).length).toBeGreaterThan(10);
      expect(media.width! / media.height!).toBeCloseTo(0.8);
      expect(String(media.url)).toMatch(/^\/seed\/[a-z-]+\.svg$/);
    }
    const colours = new Set<string>(Object.values(COLORS).map((c) => c.value));
    for (const media of rows.media) {
      expect(colours.has(String(media.url).slice(6, -4))).toBe(true);
    }
  });

  it('stocks one default warehouse, writes an opening receipt per stocked variant, and has edge cases', () => {
    expect(rows.location.name).toBe('Dhaka Warehouse');
    expect(rows.inventory).toHaveLength(rows.variants.length);
    const stocked = rows.inventory.filter((level) => (level.onHand ?? 0) > 0);
    expect(rows.movements).toHaveLength(stocked.length);
    expect(rows.inventory.some((level) => level.onHand === 0)).toBe(true);
    expect(
      rows.inventory.some((level) => (level.onHand ?? 0) > 0 && (level.onHand ?? 0) <= 5),
    ).toBe(true);
    for (const level of rows.inventory) {
      expect(level.reserved).toBe(0);
      const movement = rows.movements.find((m) => m.variantId === level.variantId);
      expect(movement?.quantity ?? 0).toBe(level.onHand); // ledger sum equals on hand (INV-S3)
    }
  });

  it('is deterministic stock, so reruns and tests agree', () => {
    expect(stockFor(3, 4)).toBe(stockFor(3, 4));
    expect(stockFor(0, 0)).toBe(0);
  });
});
