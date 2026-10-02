import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { seedCatalog } from '../../prisma/seed-catalog';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(closeDatabase);

/** A minimal variant to hang stock rows off. */
async function makeVariant(sku = 'AUR-TEST-WHITE-M') {
  const product = await db.product.create({ data: { slug: `p-${sku}`, title: 'Test shirt' } });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku, priceMinor: 100000n, avgCostMinor: 40000n },
  });
  const location = await db.location.create({ data: { name: 'Warehouse', isDefault: true } });
  return { product, variant, location };
}

describe('stock rules (INV-S1, INV-S3)', () => {
  it('rejects negative on-hand stock', async () => {
    const { variant, location } = await makeVariant();
    await expect(
      db.inventoryLevel.create({
        data: { variantId: variant.id, locationId: location.id, onHand: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rejects reserving more than is on hand', async () => {
    const { variant, location } = await makeVariant();
    await expect(
      db.inventoryLevel.create({
        data: { variantId: variant.id, locationId: location.id, onHand: 3, reserved: 4 },
      }),
    ).rejects.toThrow();
  });

  it('allows reserving up to on-hand, and refuses to go beyond it afterwards', async () => {
    const { variant, location } = await makeVariant();
    const key = { variantId_locationId: { variantId: variant.id, locationId: location.id } };
    await db.inventoryLevel.create({
      data: { variantId: variant.id, locationId: location.id, onHand: 5, reserved: 5 },
    });
    await expect(db.inventoryLevel.update({ where: key, data: { reserved: 6 } })).rejects.toThrow();
  });

  it('keeps the stock ledger append-only', async () => {
    const { variant, location } = await makeVariant();
    const movement = await db.stockMovement.create({
      data: { variantId: variant.id, locationId: location.id, type: 'receipt', quantity: 10 },
    });
    await expect(
      db.stockMovement.update({ where: { id: movement.id }, data: { quantity: 99 } }),
    ).rejects.toThrow(/append-only/);
  });

  it('refuses to delete a ledger row', async () => {
    const { variant, location } = await makeVariant();
    const movement = await db.stockMovement.create({
      data: { variantId: variant.id, locationId: location.id, type: 'receipt', quantity: 10 },
    });
    await expect(db.stockMovement.delete({ where: { id: movement.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('refuses to truncate the ledger', async () => {
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE stock_movements')).rejects.toThrow(
      /append-only/,
    );
  });

  it('keeps movement direction consistent with its type', async () => {
    const { variant, location } = await makeVariant();
    const base = { variantId: variant.id, locationId: location.id };
    await expect(
      db.stockMovement.create({ data: { ...base, type: 'receipt', quantity: -3 } }),
    ).rejects.toThrow();
  });
});

describe('catalog constraints', () => {
  it('rejects a duplicate SKU', async () => {
    const { product } = await makeVariant('AUR-DUP-1');
    await expect(
      db.productVariant.create({
        data: { productId: product.id, sku: 'AUR-DUP-1', priceMinor: 1n },
      }),
    ).rejects.toThrow();
  });

  it('rejects negative prices', async () => {
    const { product } = await makeVariant();
    await expect(
      db.productVariant.create({ data: { productId: product.id, sku: 'NEG-1', priceMinor: -1n } }),
    ).rejects.toThrow();
  });

  it('rejects a compare-at price that is not higher than the price', async () => {
    const { product } = await makeVariant();
    await expect(
      db.productVariant.create({
        data: { productId: product.id, sku: 'CMP-1', priceMinor: 500n, compareAtMinor: 500n },
      }),
    ).rejects.toThrow();
  });

  it('allows only one default location', async () => {
    await makeVariant();
    await expect(
      db.location.create({ data: { name: 'Second', isDefault: true } }),
    ).rejects.toThrow();
  });

  it('allows only one default variant per product', async () => {
    const { product } = await makeVariant();
    await db.productVariant.create({
      data: { productId: product.id, sku: 'DEF-1', priceMinor: 1n, isDefault: true },
    });
    await expect(
      db.productVariant.create({
        data: { productId: product.id, sku: 'DEF-2', priceMinor: 1n, isDefault: true },
      }),
    ).rejects.toThrow();
  });

  it('keeps root category slugs unique even though their parent is null', async () => {
    await db.category.create({ data: { slug: 'shirts', name: 'Shirts', path: 'shirts' } });
    await expect(
      db.category.create({ data: { slug: 'shirts', name: 'Shirts again', path: 'shirts-2' } }),
    ).rejects.toThrow();
  });

  it('requires descriptive alt text on images', async () => {
    const { product } = await makeVariant();
    await expect(
      db.productMedia.create({ data: { productId: product.id, url: '/x.svg', alt: '   ' } }),
    ).rejects.toThrow();
  });
});

describe('development seed', () => {
  it('writes 6 categories, 40 products, one location, and a ledger that matches stock', async () => {
    const result = await seedCatalog(db);
    expect(result).toMatchObject({ skipped: false, categories: 6, products: 40 });
    expect(await db.category.count()).toBe(6);
    expect(await db.product.count()).toBe(40);
    expect(await db.location.count()).toBe(1);
    expect(await db.productMedia.count()).toBeGreaterThanOrEqual(80);

    const mismatches = await db.$queryRaw<Array<{ variant_id: string }>>`
      SELECT l.variant_id
        FROM inventory_levels l
        LEFT JOIN (SELECT variant_id, location_id, SUM(quantity)::int AS total
                     FROM stock_movements GROUP BY variant_id, location_id) m
          ON m.variant_id = l.variant_id AND m.location_id = l.location_id
       WHERE l.on_hand <> COALESCE(m.total, 0)`;
    expect(mismatches).toEqual([]);
  });

  it('prices every variant in whole minor units above its cost', async () => {
    await seedCatalog(db);
    const bad = await db.$queryRaw<Array<{ sku: string }>>`
      SELECT sku FROM product_variants WHERE price_minor <= avg_cost_minor OR price_minor % 100 <> 0`;
    expect(bad).toEqual([]);
  });

  it('is safe to run twice', async () => {
    await seedCatalog(db);
    const again = await seedCatalog(db);
    expect(again.skipped).toBe(true);
    expect(await db.product.count()).toBe(40);
  });
});
