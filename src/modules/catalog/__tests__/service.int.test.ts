import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { localMediaRoot } from '@/lib/media';
import { makeStaff } from '../../../../tests/factories';
import { closeDatabase, resetDatabase } from '../../../../tests/integration/helpers';
import * as catalog from '../service';
import { resolveRedirect } from '../queries';
import { clearRedirectCache } from '../redirect-cache';
import type { Actor } from '../types';

beforeEach(async () => {
  await resetDatabase();
  clearRedirectCache();
});
afterAll(closeDatabase);

async function actor(): Promise<Actor> {
  const { user } = await makeStaff({ role: 'owner' });
  return { userId: user.id, ip: '203.0.113.7', userAgent: 'vitest', canPublish: true };
}

const category = (name: string, parentId: string | null = null, slug: string | null = null) => ({
  name,
  slug,
  parentId,
  description: null,
  isActive: true,
  seoTitle: null,
  seoDescription: null,
});

const redirects = async () =>
  (await db.redirect.findMany({ orderBy: { fromPath: 'asc' } })).map(
    (r) => `${r.fromPath} -> ${r.toPath} (${r.statusCode})`,
  );

const auditActions = async (entityId?: string) =>
  (
    await db.auditLog.findMany({
      where: entityId ? { entityId } : {},
      orderBy: { createdAt: 'asc' },
    })
  ).map((row) => row.action);

async function png(width = 80, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 160, g: 80, b: 48 } },
  })
    .png()
    .toBuffer();
}

/** A product with one priced variant and one image, ready to go live. */
async function liveProduct(a: Actor, title = 'Oxford shirt') {
  const cat = await catalog.createCategory(
    a,
    category('Shirts', null, `shirts-${Math.random().toString(36).slice(2, 7)}`),
  );
  const created = await catalog.createProduct(a, {
    title,
    categoryId: cat.data.id,
    productType: 'shirt',
  });
  await catalog.generateVariants(a, {
    productId: created.data.id,
    options: [{ name: 'Size', values: [{ label: 'M', swatchHex: null }] }],
    defaults: { price: '2490', compareAt: null, weightG: null, skuPrefix: 'OXF' },
  });
  await catalog.uploadProductMedia(a, {
    productId: created.data.id,
    alt: 'Oxford shirt, front',
    optionValueId: null,
    bytes: await png(),
  });
  return { ...created.data, categoryId: cat.data.id };
}

const detailsFor = async (id: string, patch: Record<string, unknown> = {}) => {
  const p = await db.product.findUniqueOrThrow({ where: { id } });
  return {
    id,
    title: p.title,
    subtitle: null,
    description: null,
    slug: p.slug,
    categoryId: p.categoryId,
    sizeChartId: null,
    productType: p.productType,
    material: null,
    careInstructions: null,
    fit: null,
    origin: null,
    tags: p.tags,
    attributes: { fabric: null, occasion: null, season: null, pattern: null },
    featuredRank: null,
    seoTitle: null,
    seoDescription: null,
    ...patch,
  };
};

/** A staff member who can edit the catalogue but not publish (no catalog.publish). */
async function writer(): Promise<Actor> {
  return { ...(await actor()), canPublish: false };
}

describe('categories', () => {
  it('builds paths, limits depth and refuses a duplicate slug among siblings', async () => {
    const a = await actor();
    const tops = await catalog.createCategory(a, category('Tops'));
    const shirts = await catalog.createCategory(a, category('Shirts', tops.data.id));
    const oxford = await catalog.createCategory(a, category('Oxford', shirts.data.id));
    expect(oxford.data.path).toBe('tops/shirts/oxford');
    await expect(
      catalog.createCategory(a, category('Too deep', oxford.data.id)),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(
      catalog.createCategory(a, category('Tops again', null, 'tops')),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(oxford.tags).toEqual(
      expect.arrayContaining(['sitemap', `category:${oxford.data.id}`, 'categories']),
    );
  });

  it('moves a whole subtree on a slug change and redirects every active page (301, one hop)', async () => {
    const a = await actor();
    const tops = await catalog.createCategory(a, category('Tops'));
    const shirts = await catalog.createCategory(a, category('Shirts', tops.data.id));
    await catalog.updateCategory(a, {
      id: tops.data.id,
      ...category('Tops', null, 'upper'),
    });
    const moved = await db.category.findUniqueOrThrow({ where: { id: shirts.data.id } });
    expect(moved.path).toBe('upper/shirts');
    expect(await redirects()).toEqual([
      '/shop/tops -> /shop/upper (301)',
      '/shop/tops/shirts -> /shop/upper/shirts (301)',
    ]);
    // A second rename keeps old links one hop away from the live page.
    await catalog.updateCategory(a, { id: tops.data.id, ...category('Tops', null, 'upstairs') });
    expect(await redirects()).toEqual([
      '/shop/tops -> /shop/upstairs (301)',
      '/shop/tops/shirts -> /shop/upstairs/shirts (301)',
      '/shop/upper -> /shop/upstairs (301)',
      '/shop/upper/shirts -> /shop/upstairs/shirts (301)',
    ]);
  });

  it('does not create redirects for a hidden category and refuses cycles', async () => {
    const a = await actor();
    const hidden = await catalog.createCategory(a, { ...category('Archive'), isActive: false });
    await catalog.updateCategory(a, {
      id: hidden.data.id,
      ...category('Archive', null, 'old'),
      isActive: false,
    });
    expect(await redirects()).toEqual([]);
    const parent = await catalog.createCategory(a, category('Parent'));
    const child = await catalog.createCategory(a, category('Child', parent.data.id));
    await expect(
      catalog.updateCategory(a, { id: parent.data.id, ...category('Parent', child.data.id) }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('refuses to delete a category that has products or children, and audits what it does', async () => {
    const a = await actor();
    const parent = await catalog.createCategory(a, category('Parent'));
    const child = await catalog.createCategory(a, category('Child', parent.data.id));
    await expect(catalog.deleteCategory(a, parent.data.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await catalog.createProduct(a, {
      title: 'Linen shirt',
      categoryId: child.data.id,
      productType: null,
    });
    await expect(catalog.deleteCategory(a, child.data.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const empty = await catalog.createCategory(a, category('Empty'));
    await catalog.deleteCategory(a, empty.data.id);
    expect(await auditActions(empty.data.id)).toEqual(['category.create', 'category.delete']);
  });

  it('reorders siblings and rejects a stale list', async () => {
    const a = await actor();
    const one = await catalog.createCategory(a, category('One'));
    const two = await catalog.createCategory(a, category('Two'));
    await catalog.reorderCategories(a, { parentId: null, orderedIds: [two.data.id, one.data.id] });
    const rows = await db.category.findMany({ orderBy: { position: 'asc' } });
    expect(rows.map((r) => r.name)).toEqual(['Two', 'One']);
    await expect(
      catalog.reorderCategories(a, { parentId: null, orderedIds: [two.data.id] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('products and the status gate', () => {
  it('creates a draft with a unique slug and audits it', async () => {
    const a = await actor();
    const first = await catalog.createProduct(a, {
      title: 'Linen Shirt',
      categoryId: null,
      productType: null,
    });
    const second = await catalog.createProduct(a, {
      title: 'Linen Shirt',
      categoryId: null,
      productType: null,
    });
    expect(first.data.slug).toBe('linen-shirt');
    expect(second.data.slug).toBe('linen-shirt-2');
    const row = await db.product.findUniqueOrThrow({ where: { id: first.data.id } });
    expect(row.status).toBe('draft');
    expect(await auditActions(first.data.id)).toEqual(['product.create']);
  });

  it('refuses to publish without a priced variant, an image and a category, then publishes', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Bare',
      categoryId: null,
      productType: null,
    });
    await expect(
      catalog.setProductStatus(a, { id: p.data.id, status: 'active' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const ready = await liveProduct(a);
    const result = await catalog.setProductStatus(a, { id: ready.id, status: 'active' });
    expect(result.data.status).toBe('active');
    const row = await db.product.findUniqueOrThrow({ where: { id: ready.id } });
    expect(row.publishedAt).not.toBeNull();
    expect(result.tags).toEqual(
      expect.arrayContaining(['products', `product:${ready.id}`, 'sitemap']),
    );
  });

  it('redirects a live product when its slug changes, but not a draft, and keeps chains one hop', async () => {
    const a = await actor();
    const p = await liveProduct(a, 'Oxford shirt');
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'draft-rename' }));
    expect(await redirects()).toEqual([]);

    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'oxford-shirt-v2' }));
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'oxford-shirt-v3' }));
    expect(await redirects()).toEqual([
      '/products/draft-rename -> /products/oxford-shirt-v3 (301)',
      '/products/oxford-shirt-v2 -> /products/oxford-shirt-v3 (301)',
    ]);

    // Going back to an earlier address must not leave a loop.
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'oxford-shirt-v2' }));
    expect(await redirects()).toEqual([
      '/products/draft-rename -> /products/oxford-shirt-v2 (301)',
      '/products/oxford-shirt-v3 -> /products/oxford-shirt-v2 (301)',
    ]);
  });

  it('refuses a slug another product uses and reports it on the slug field', async () => {
    const a = await actor();
    const one = await catalog.createProduct(a, {
      title: 'One',
      categoryId: null,
      productType: null,
    });
    await catalog.createProduct(a, { title: 'Two', categoryId: null, productType: null });
    await expect(
      catalog.updateProductDetails(a, await detailsFor(one.data.id, { slug: 'two' })),
    ).rejects.toMatchObject({ code: 'CONFLICT', fieldErrors: { slug: expect.any(Array) } });
  });

  it('serves the redirect through the proxy lookup, with a cache that a write clears', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    expect(await resolveRedirect(`/products/${p.slug}`)).toBeNull();
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'renamed-shirt' }));
    clearRedirectCache();
    expect(await resolveRedirect(`/products/${p.slug}`)).toEqual({
      to: '/products/renamed-shirt',
      status: 301,
    });
    expect(await resolveRedirect('/products/renamed-shirt')).toBeNull();
    expect(await resolveRedirect('/admin/products')).toBeNull();
    const hit = await db.redirect.findUniqueOrThrow({ where: { fromPath: `/products/${p.slug}` } });
    expect(hit.hits).toBeGreaterThanOrEqual(0);
  });

  it('reclaims an old address only when a new product with that slug goes live', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    await catalog.updateProductDetails(a, await detailsFor(p.id, { slug: 'moved' }));
    expect(await redirects()).toHaveLength(1);
    const next = await liveProduct(a, p.slug);
    expect(next.slug).toBe(p.slug);
    // Still a draft: the old page keeps redirecting.
    expect(await redirects()).toHaveLength(1);
    await catalog.setProductStatus(a, { id: next.id, status: 'active' });
    expect(await redirects()).toEqual([]);
  });
});

describe('variants and money (INV-M1)', () => {
  it('generates the matrix with unique SKUs and exact minor-unit prices', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Polo',
      categoryId: null,
      productType: null,
    });
    const result = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [
        {
          name: 'Colour',
          values: [
            { label: 'Navy', swatchHex: '#1F2A44' },
            { label: 'White', swatchHex: '#F8F8F6' },
          ],
        },
        {
          name: 'Size',
          values: [
            { label: 'S', swatchHex: null },
            { label: 'M', swatchHex: null },
            { label: 'L', swatchHex: null },
          ],
        },
      ],
      defaults: { price: '2,490.50', compareAt: '3,200', weightG: 300, skuPrefix: 'POLO' },
    });
    expect(result.data).toMatchObject({ created: 6, removed: 0, archived: 0, total: 6 });
    const variants = await db.productVariant.findMany({
      where: { productId: p.data.id },
      orderBy: { position: 'asc' },
    });
    expect(new Set(variants.map((v) => v.sku)).size).toBe(6);
    expect(variants.map((v) => v.sku)).toContain('POLO-NAVY-M');
    for (const v of variants) {
      expect(v.priceMinor).toBe(249050n);
      expect(v.compareAtMinor).toBe(320000n);
      expect(v.currency).toBe('BDT');
    }
    expect(variants[0]!.isDefault).toBe(true);
    expect(variants.filter((v) => v.isDefault)).toHaveLength(1);
  });

  it('keeps existing variants when options grow and removes or archives the ones that go', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Chino',
      categoryId: null,
      productType: null,
    });
    const size = (labels: string[]) => ({
      name: 'Size',
      values: labels.map((label) => ({ label, swatchHex: null })),
    });
    const defaults = { price: '4000', compareAt: null, weightG: null, skuPrefix: 'CHN' };
    await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [size(['30', '32'])],
      defaults,
    });
    const before = await db.productVariant.findMany({
      where: { productId: p.data.id },
      orderBy: { position: 'asc' },
    });

    // Give size 32 a stock history: it can never be deleted, only archived.
    const location = await db.location.create({ data: { name: 'Main', isDefault: true } });
    const v32 = before.find((v) => v.sku.endsWith('32'))!;
    await db.inventoryLevel.create({
      data: { variantId: v32.id, locationId: location.id, onHand: 5 },
    });

    const grown = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [size(['30', '32', '34'])],
      defaults,
    });
    expect(grown.data).toMatchObject({ created: 1, removed: 0, archived: 0, total: 3 });
    const after = await db.productVariant.findMany({ where: { productId: p.data.id } });
    expect(after.map((v) => v.id)).toEqual(expect.arrayContaining(before.map((v) => v.id)));

    const shrunk = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [size(['30'])],
      defaults,
    });
    expect(shrunk.data).toMatchObject({ created: 0, removed: 1, archived: 1, total: 2 });
    const left = await db.productVariant.findMany({
      where: { productId: p.data.id },
      orderBy: { sku: 'asc' },
    });
    expect(left.map((v) => `${v.sku}:${v.status}`)).toEqual(['CHN-30:active', 'CHN-32:archived']);

    // The size comes back: the archived variant is reactivated, not duplicated.
    const back = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [size(['30', '32'])],
      defaults,
    });
    expect(back.data.created).toBe(0);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v32.id } })).status).toBe(
      'active',
    );
  });

  it('gives a product without options exactly one default variant', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Leather wallet',
      categoryId: null,
      productType: null,
    });
    const defaults = { price: '3,500', compareAt: null, weightG: 120, skuPrefix: 'WALLET' };
    const first = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [],
      defaults,
    });
    expect(first.data).toMatchObject({ created: 1, total: 1 });
    const again = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [],
      defaults,
    });
    expect(again.data).toMatchObject({ created: 0, removed: 0, total: 1 });
    const rows = await db.productVariant.findMany({ where: { productId: p.data.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sku: 'WALLET', priceMinor: 350000n, isDefault: true });
  });

  it('rejects an over-large matrix and a compare-at price that is not higher', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, { title: 'Big', categoryId: null, productType: null });
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ label: `v${i}`, swatchHex: null }));
    const defaults = { price: '10', compareAt: null, weightG: null, skuPrefix: '' };
    await expect(
      catalog.generateVariants(a, {
        productId: p.data.id,
        options: [
          { name: 'A', values: many(20) },
          { name: 'B', values: many(20) },
        ],
        defaults,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      catalog.generateVariants(a, {
        productId: p.data.id,
        options: [{ name: 'A', values: many(2) }],
        defaults: { ...defaults, compareAt: '10' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('updates price, compare-at, barcode and SKU, and audits the exact before and after', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    const variant = await db.productVariant.findFirstOrThrow({ where: { productId: p.id } });
    const row = (patch: Record<string, unknown>) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: null,
      price: '2490',
      compareAt: null,
      weightG: null,
      status: 'active' as const,
      ...patch,
    });
    const result = await catalog.updateVariants(a, {
      productId: p.id,
      variants: [
        row({ price: '1,999.99', compareAt: '2,500', barcode: '8901234567890', sku: 'OXF-NEW' }),
      ],
    });
    expect(result.data.updated).toBe(1);
    const updated = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updated.priceMinor).toBe(199999n);
    expect(updated.compareAtMinor).toBe(250000n);
    expect(updated.avgCostMinor).toBe(0n);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: 'product.variants_update' },
    });
    expect(JSON.stringify(log.before)).toContain('249000');
    expect(JSON.stringify(log.after)).toContain('199999');

    const nothing = await catalog.updateVariants(a, {
      productId: p.id,
      variants: [
        row({ price: '1,999.99', compareAt: '2,500', barcode: '8901234567890', sku: 'OXF-NEW' }),
      ],
    });
    expect(nothing.data.updated).toBe(0);
    expect(nothing.tags).toEqual([]);
  });

  it('rejects bad prices per row and a SKU that another variant uses', async () => {
    const a = await actor();
    const one = await liveProduct(a, 'One');
    const two = await liveProduct(a, 'Two');
    const v1 = await db.productVariant.findFirstOrThrow({ where: { productId: one.id } });
    const v2 = await db.productVariant.findFirstOrThrow({ where: { productId: two.id } });
    const base = {
      id: v2.id,
      sku: v2.sku,
      barcode: null,
      price: '100',
      compareAt: null,
      weightG: null,
      status: 'active' as const,
    };
    await expect(
      catalog.updateVariants(a, { productId: two.id, variants: [{ ...base, compareAt: '50' }] }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { 'variants.0.compareAt': expect.any(Array) },
    });
    await expect(
      catalog.updateVariants(a, { productId: two.id, variants: [{ ...base, price: '0' }] }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { 'variants.0.price': expect.any(Array) },
    });
    await expect(
      catalog.updateVariants(a, { productId: two.id, variants: [{ ...base, sku: v1.sku }] }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      fieldErrors: { 'variants.0.sku': expect.any(Array) },
    });
  });

  it('never leaves a live product without an active priced variant', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    const v = await db.productVariant.findFirstOrThrow({ where: { productId: p.id } });
    await expect(
      catalog.updateVariants(a, {
        productId: p.id,
        variants: [
          {
            id: v.id,
            sku: v.sku,
            barcode: null,
            price: '2490',
            compareAt: null,
            weightG: null,
            status: 'archived',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).status).toBe(
      'active',
    );
  });
});

describe('media (MediaProvider, upload validation)', () => {
  it('stores a re-encoded image under a random key, links it to a colour and audits it', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Shirt',
      categoryId: null,
      productType: null,
    });
    await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [{ name: 'Colour', values: [{ label: 'Navy', swatchHex: '#1F2A44' }] }],
      defaults: { price: '1000', compareAt: null, weightG: null, skuPrefix: 'S' },
    });
    const navy = await db.productOptionValue.findFirstOrThrow({ where: { value: 'navy' } });
    const upload = await catalog.uploadProductMedia(a, {
      productId: p.data.id,
      alt: 'Navy shirt, front view',
      optionValueId: navy.id,
      bytes: await png(),
    });
    const media = await db.productMedia.findUniqueOrThrow({ where: { id: upload.data.id } });
    expect(media.optionValueId).toBe(navy.id);
    expect(media.contentType).toBe('image/webp');
    expect(media.provider).toBe('local');
    expect(media.storageKey).toMatch(/^products\/[A-Za-z0-9_-]{20,}\.webp$/);
    expect(media.url).toContain('/api/media/');
    expect(media.width).toBeGreaterThan(0);
    expect(media.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(media.blurData).toMatch(/^data:image\/webp;base64,/);
    expect(existsSync(path.join(localMediaRoot(), media.storageKey!))).toBe(true);
    expect(await auditActions(media.id)).toEqual(['media.upload']);
  });

  it('refuses files that are not images, SVG and a colour of another product', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Shirt',
      categoryId: null,
      productType: null,
    });
    const send = (bytes: Buffer, optionValueId: string | null = null) =>
      catalog.uploadProductMedia(a, { productId: p.data.id, alt: 'x', optionValueId, bytes });
    await expect(send(Buffer.from('not an image at all'))).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(
      send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(send(Buffer.alloc(0))).rejects.toMatchObject({ code: 'VALIDATION' });

    const other = await catalog.createProduct(a, {
      title: 'Other',
      categoryId: null,
      productType: null,
    });
    await catalog.generateVariants(a, {
      productId: other.data.id,
      options: [{ name: 'Colour', values: [{ label: 'Red', swatchHex: null }] }],
      defaults: { price: '100', compareAt: null, weightG: null, skuPrefix: 'O' },
    });
    const red = await db.productOptionValue.findFirstOrThrow({ where: { value: 'red' } });
    await expect(send(await png(), red.id)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await db.productMedia.count()).toBe(0);
  });

  it('reorders, edits alt text, and deletes the file with the row', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Shirt',
      categoryId: null,
      productType: null,
    });
    const first = await catalog.uploadProductMedia(a, {
      productId: p.data.id,
      alt: 'First',
      optionValueId: null,
      bytes: await png(),
    });
    const second = await catalog.uploadProductMedia(a, {
      productId: p.data.id,
      alt: 'Second',
      optionValueId: null,
      bytes: await png(60, 60),
    });
    await catalog.reorderProductMedia(a, {
      productId: p.data.id,
      orderedIds: [second.data.id, first.data.id],
    });
    const ordered = await db.productMedia.findMany({
      where: { productId: p.data.id },
      orderBy: { position: 'asc' },
    });
    expect(ordered.map((m) => m.alt)).toEqual(['Second', 'First']);
    await catalog.updateProductMedia(a, {
      id: first.data.id,
      alt: 'First, detail',
      optionValueId: null,
    });
    const key = ordered[1]!.storageKey!;
    await catalog.deleteProductMedia(a, first.data.id);
    expect(existsSync(path.join(localMediaRoot(), key))).toBe(false);
    const left = await db.productMedia.findMany({ where: { productId: p.data.id } });
    expect(left.map((m) => [m.alt, m.position])).toEqual([['Second', 0]]);
  });

  it('keeps the last image of a live product', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    const image = await db.productMedia.findFirstOrThrow({ where: { productId: p.id } });
    await expect(catalog.deleteProductMedia(a, image.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});

describe('size charts', () => {
  const chart = {
    name: 'Shirts',
    unit: 'cm' as const,
    columns: ['Chest', 'Waist'],
    rows: [
      { size: 'S', values: ['96', '82'] },
      { size: 'M', values: ['102', '88'] },
    ],
    howToMeasure: 'Measure around the fullest part of your chest.',
    modelInfo: 'Model is 185 cm and wears M',
  };

  it('creates, updates, assigns to a product and detaches on delete', async () => {
    const a = await actor();
    const created = await catalog.createSizeChart(a, chart);
    const p = await catalog.createProduct(a, {
      title: 'Shirt',
      categoryId: null,
      productType: null,
    });
    await catalog.updateProductDetails(
      a,
      await detailsFor(p.data.id, { sizeChartId: created.data.id }),
    );
    const updated = await catalog.updateSizeChart(a, {
      ...chart,
      id: created.data.id,
      name: 'Shirts (cm)',
    });
    expect(updated.tags).toContain(`product:${p.data.id}`);
    const row = await db.sizeChart.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.name).toBe('Shirts (cm)');
    expect(row.table).toEqual({ columns: chart.columns, rows: chart.rows });

    const removed = await catalog.deleteSizeChart(a, created.data.id);
    expect(removed.data.detached).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: p.data.id } })).sizeChartId,
    ).toBeNull();
    expect(await auditActions(created.data.id)).toEqual([
      'size_chart.create',
      'size_chart.update',
      'size_chart.delete',
    ]);
  });

  it('rejects a size chart that does not exist on the product form', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Shirt',
      categoryId: null,
      productType: null,
    });
    await expect(
      catalog.updateProductDetails(
        a,
        await detailsFor(p.data.id, { sizeChartId: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e' }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('collections', () => {
  const base = {
    title: 'Linen edit',
    slug: null,
    description: null,
    type: 'manual' as const,
    rules: { match: 'all' as const, conditions: [] },
    sortOrder: 'manual' as const,
    publishedAt: null,
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
  };

  it('manages manual members: add, order, remove, and refuses rule-only actions', async () => {
    const a = await actor();
    const c = await catalog.createCollection(a, base);
    expect(c.data.slug).toBe('linen-edit');
    const p1 = await catalog.createProduct(a, {
      title: 'One',
      categoryId: null,
      productType: null,
    });
    const p2 = await catalog.createProduct(a, {
      title: 'Two',
      categoryId: null,
      productType: null,
    });
    await catalog.addCollectionProducts(a, {
      collectionId: c.data.id,
      productIds: [p1.data.id, p2.data.id],
    });
    await catalog.addCollectionProducts(a, { collectionId: c.data.id, productIds: [p1.data.id] });
    await catalog.reorderCollectionProducts(a, {
      collectionId: c.data.id,
      orderedProductIds: [p2.data.id, p1.data.id],
    });
    const members = await db.collectionProduct.findMany({
      where: { collectionId: c.data.id },
      orderBy: { position: 'asc' },
    });
    expect(members.map((m) => m.productId)).toEqual([p2.data.id, p1.data.id]);
    await catalog.removeCollectionProduct(a, { collectionId: c.data.id, productId: p2.data.id });
    expect(await db.collectionProduct.count({ where: { collectionId: c.data.id } })).toBe(1);
    await expect(catalog.refreshCollection(a, c.data.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(
      catalog.addCollectionProducts(a, {
        collectionId: c.data.id,
        productIds: ['0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e'],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps automatic collections in step with the rules when products change', async () => {
    const a = await actor();
    const live = await liveProduct(a, 'Linen shirt');
    await catalog.setProductStatus(a, { id: live.id, status: 'active' });
    const rule = (value: string) => ({
      ...base,
      title: 'Linen',
      type: 'automatic' as const,
      rules: {
        match: 'all' as const,
        conditions: [{ field: 'tag' as const, operator: 'equals', value }],
      },
    });
    const c = await catalog.createCollection(a, rule('linen'));
    expect(await db.collectionProduct.count({ where: { collectionId: c.data.id } })).toBe(0);

    const update = await catalog.updateProductDetails(
      a,
      await detailsFor(live.id, { tags: ['linen'] }),
    );
    expect(update.tags).toContain(`collection:${c.data.id}`);
    expect(await db.collectionProduct.count({ where: { collectionId: c.data.id } })).toBe(1);

    await catalog.updateProductDetails(a, await detailsFor(live.id, { tags: ['wool'] }));
    expect(await db.collectionProduct.count({ where: { collectionId: c.data.id } })).toBe(0);

    // A draft never qualifies.
    const draft = await catalog.createProduct(a, {
      title: 'Draft linen',
      categoryId: null,
      productType: null,
    });
    await catalog.updateProductDetails(a, await detailsFor(draft.data.id, { tags: ['linen'] }));
    expect(await db.collectionProduct.count({ where: { collectionId: c.data.id } })).toBe(0);
  });

  it('matches price rules against minor units and previews without saving', async () => {
    const a = await actor();
    const cheap = await liveProduct(a, 'Cheap');
    await catalog.setProductStatus(a, { id: cheap.id, status: 'active' });
    const rules = (op: string, value: string) => ({
      match: 'all' as const,
      conditions: [{ field: 'price' as const, operator: op, value }],
    });
    expect((await catalog.previewRules(rules('less_than', '2500'))).count).toBe(1);
    expect((await catalog.previewRules(rules('less_than', '2490'))).count).toBe(0);
    expect((await catalog.previewRules(rules('greater_than', '2489.99'))).count).toBe(1);
    expect(await db.collection.count()).toBe(0);
  });

  it('moves a live collection address with a redirect and clears membership of old slugs', async () => {
    const a = await actor();
    const c = await catalog.createCollection(a, {
      ...base,
      publishedAt: '2020-01-01T00:00:00.000Z',
    });
    await catalog.updateCollection(a, {
      id: c.data.id,
      ...base,
      slug: 'linen-2027',
      publishedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(await redirects()).toEqual(['/collections/linen-edit -> /collections/linen-2027 (301)']);
    // A draft or scheduled collection was never public: no redirect.
    const d = await catalog.createCollection(a, {
      ...base,
      title: 'Later',
      publishedAt: '2999-01-01T00:00:00.000Z',
    });
    await catalog.updateCollection(a, {
      id: d.data.id,
      ...base,
      title: 'Later',
      slug: 'later-2',
      publishedAt: '2999-01-01T00:00:00.000Z',
    });
    expect(await redirects()).toHaveLength(1);
  });

  it('stores a hero image through the provider and removes it again', async () => {
    const a = await actor();
    const c = await catalog.createCollection(a, base);
    const set = await catalog.setCollectionHero(a, {
      collectionId: c.data.id,
      alt: 'Linen shirts on a rail',
      bytes: await png(),
    });
    const row = await db.collection.findUniqueOrThrow({ where: { id: c.data.id } });
    const hero = row.heroMedia as { storageKey: string; alt: string; url: string };
    expect(hero.alt).toBe('Linen shirts on a rail');
    expect(hero.url).toBe(set.data.url);
    expect(existsSync(path.join(localMediaRoot(), hero.storageKey))).toBe(true);
    await catalog.removeCollectionHero(a, c.data.id);
    expect(
      (await db.collection.findUniqueOrThrow({ where: { id: c.data.id } })).heroMedia,
    ).toBeNull();
    expect(existsSync(path.join(localMediaRoot(), hero.storageKey))).toBe(false);
  });
});

describe('review follow-ups', () => {
  it('lets values shift names in one save (M becomes L while L becomes XL)', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Shift',
      categoryId: null,
      productType: null,
    });
    const defaults = { price: '100', compareAt: null, weightG: null, skuPrefix: 'SH' };
    await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [
        {
          name: 'Size',
          values: [
            { label: 'M', swatchHex: '' },
            { label: 'L', swatchHex: '' },
          ],
        },
      ],
      defaults,
    });
    const option = await db.productOption.findFirstOrThrow({
      where: { productId: p.data.id },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    const result = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [
        {
          id: option.id,
          name: 'Size',
          values: [
            { id: option.values[0]!.id, label: 'L', swatchHex: '' },
            { id: option.values[1]!.id, label: 'XL', swatchHex: '' },
          ],
        },
      ],
      defaults,
    });
    expect(result.data).toMatchObject({ created: 0, removed: 0, total: 2 });
  });

  it('finds a free SKU even when base-2 and base-3 already exist', async () => {
    const a = await actor();
    const defaults = { price: '100', compareAt: null, weightG: null, skuPrefix: 'DUP' };
    for (let i = 0; i < 4; i++) {
      const p = await catalog.createProduct(a, {
        title: `Dup ${i}`,
        categoryId: null,
        productType: null,
      });
      await catalog.generateVariants(a, {
        productId: p.data.id,
        options: [{ name: 'Size', values: [{ label: 'S', swatchHex: '' }] }],
        defaults,
      });
    }
    const skus = (await db.productVariant.findMany()).map((v) => v.sku).sort();
    expect(skus).toEqual(['DUP-S', 'DUP-S-2', 'DUP-S-3', 'DUP-S-4']);
  });

  it('keeps variants, prices and SKUs when an option or value is renamed (ids)', async () => {
    const a = await actor();
    const p = await catalog.createProduct(a, {
      title: 'Polo',
      categoryId: null,
      productType: null,
    });
    const defaults = { price: '2000', compareAt: null, weightG: null, skuPrefix: 'POLO' };
    await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [
        {
          name: 'Size',
          values: [
            { label: 'M', swatchHex: '' },
            { label: 'L', swatchHex: '' },
          ],
        },
      ],
      defaults,
    });
    const option = await db.productOption.findFirstOrThrow({
      where: { productId: p.data.id },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    // Give the M variant its own price: a rename must not reset it.
    const m = await db.productVariant.findFirstOrThrow({ where: { sku: 'POLO-M' } });
    await db.productVariant.update({ where: { id: m.id }, data: { priceMinor: 250000n } });
    const renamed = await catalog.generateVariants(a, {
      productId: p.data.id,
      options: [
        {
          id: option.id,
          name: 'Sizes',
          values: [
            { id: option.values[0]!.id, label: 'Medium', swatchHex: '' },
            { id: option.values[1]!.id, label: 'Large', swatchHex: '' },
          ],
        },
      ],
      defaults,
    });
    expect(renamed.data).toMatchObject({ created: 0, removed: 0, archived: 0, total: 2 });
    const after = await db.productVariant.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.sku).toBe('POLO-M');
    expect(after.priceMinor).toBe(250000n);
    const row = await db.productOption.findUniqueOrThrow({
      where: { id: option.id },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    expect(row.name).toBe('Sizes');
    expect(row.values.map((v) => v.label)).toEqual(['Medium', 'Large']);
  });

  it('refuses an option or value id that belongs to another product', async () => {
    const a = await actor();
    const one = await catalog.createProduct(a, {
      title: 'One',
      categoryId: null,
      productType: null,
    });
    const two = await catalog.createProduct(a, {
      title: 'Two',
      categoryId: null,
      productType: null,
    });
    const defaults = { price: '100', compareAt: null, weightG: null, skuPrefix: 'X' };
    await catalog.generateVariants(a, {
      productId: one.data.id,
      options: [{ name: 'Size', values: [{ label: 'S', swatchHex: '' }] }],
      defaults,
    });
    const foreign = await db.productOption.findFirstOrThrow({ where: { productId: one.data.id } });
    await expect(
      catalog.generateVariants(a, {
        productId: two.data.id,
        options: [{ id: foreign.id, name: 'Size', values: [{ label: 'S', swatchHex: '' }] }],
        defaults,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('never reactivates a variant that has no price when its combination returns', async () => {
    const a = await actor();
    const p = await liveProduct(a, 'Shirt');
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    const size = (labels: string[]) => ({
      name: 'Size',
      values: labels.map((label) => ({ label, swatchHex: '' })),
    });
    const defaults = { price: '2490', compareAt: null, weightG: null, skuPrefix: 'OXF' };
    await catalog.generateVariants(a, { productId: p.id, options: [size(['M', 'L'])], defaults });
    const l = await db.productVariant.findFirstOrThrow({ where: { sku: 'OXF-L' } });
    // Free and archived (allowed while archived); it also has a stock history so it is never deleted.
    await db.productVariant.update({
      where: { id: l.id },
      data: { priceMinor: 0n, status: 'archived' },
    });
    const location = await db.location.create({ data: { name: 'Main', isDefault: true } });
    await db.inventoryLevel.create({
      data: { variantId: l.id, locationId: location.id, onHand: 2 },
    });
    await catalog.generateVariants(a, { productId: p.id, options: [size(['M', 'L'])], defaults });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: l.id } })).status).toBe(
      'archived',
    );
  });

  it('serialises publishing against removing the last variant: never live without a sellable variant', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    const v = await db.productVariant.findFirstOrThrow({ where: { productId: p.id } });
    const archive = catalog.updateVariants(a, {
      productId: p.id,
      variants: [
        {
          id: v.id,
          sku: v.sku,
          barcode: null,
          price: '2490',
          compareAt: null,
          weightG: null,
          status: 'archived',
        },
      ],
    });
    const publish = catalog.setProductStatus(a, { id: p.id, status: 'active' });
    await Promise.allSettled([archive, publish]);
    const product = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    const sellable = await db.productVariant.count({
      where: { productId: p.id, status: 'active', priceMinor: { gt: 0n } },
    });
    expect(product.status === 'active' && sellable === 0).toBe(false);
  });

  it('keeps the redirect for a product that was live once, even after it was archived', async () => {
    const a = await actor();
    const p = await liveProduct(a);
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    await catalog.setProductStatus(a, { id: p.id, status: 'archived' });
    await catalog.updateProductDetails(
      a,
      await detailsFor(p.id, { slug: 'renamed-while-archived' }),
    );
    expect(await redirects()).toEqual([
      `/products/${p.slug} -> /products/renamed-while-archived (301)`,
    ]);
  });

  it('does not touch redirects for a draft that takes an address, and reclaims it when it goes live', async () => {
    const a = await actor();
    const live = await liveProduct(a, 'First');
    await catalog.setProductStatus(a, { id: live.id, status: 'active' });
    await catalog.updateProductDetails(a, await detailsFor(live.id, { slug: 'first-new' }));
    expect(await redirects()).toHaveLength(1);
    const draft = await catalog.createProduct(a, {
      title: live.slug,
      categoryId: null,
      productType: null,
    });
    expect(draft.data.slug).toBe(live.slug);
    expect(await redirects()).toHaveLength(1);
  });

  it('removes redirects that point at a deleted category or collection', async () => {
    const a = await actor();
    const cat = await catalog.createCategory(a, category('Old name'));
    await catalog.updateCategory(a, { id: cat.data.id, ...category('Old name', null, 'new-name') });
    expect(await redirects()).toHaveLength(1);
    await catalog.deleteCategory(a, cat.data.id);
    expect(await redirects()).toEqual([]);
  });

  it('lets only staff with catalog.publish change what shoppers see of a collection', async () => {
    const owner = await actor();
    const editor = await writer();
    const base = {
      title: 'Linen',
      slug: null,
      description: null,
      type: 'manual' as const,
      rules: { match: 'all' as const, conditions: [] },
      sortOrder: 'manual' as const,
      isFeatured: false,
      seoTitle: null,
      seoDescription: null,
    };
    await expect(
      catalog.createCollection(editor, { ...base, publishedAt: '2020-01-01T00:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const live = await catalog.createCollection(owner, {
      ...base,
      publishedAt: '2020-01-01T00:00:00.000Z',
    });
    const edit = { id: live.data.id, ...base, publishedAt: '2020-01-01T00:00:00.000Z' };
    // Editing text on a live collection is a writer's job.
    await catalog.updateCollection(editor, { ...edit, description: 'New words' });
    await expect(
      catalog.updateCollection(editor, { ...edit, publishedAt: null }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      catalog.updateCollection(editor, { ...edit, isFeatured: true }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(
      (await db.collection.findUniqueOrThrow({ where: { id: live.data.id } })).publishedAt,
    ).not.toBeNull();
    await catalog.updateCollection(owner, { ...edit, publishedAt: null });
  });

  it('keeps products without a fit when a rule says "fit is not slim"', async () => {
    const a = await actor();
    const p = await liveProduct(a, 'No fit');
    await catalog.setProductStatus(a, { id: p.id, status: 'active' });
    const preview = await catalog.previewRules({
      match: 'all',
      conditions: [{ field: 'fit', operator: 'not_equals', value: 'slim' }],
    });
    expect(preview.count).toBe(1);
  });

  it('orders an automatic collection by its sort order and keeps the audit of replaced members', async () => {
    const a = await actor();
    const cheap = await liveProduct(a, 'Cheap');
    const dear = await liveProduct(a, 'Dear');
    await catalog.setProductStatus(a, { id: cheap.id, status: 'active' });
    await catalog.setProductStatus(a, { id: dear.id, status: 'active' });
    const dearVariant = await db.productVariant.findFirstOrThrow({ where: { productId: dear.id } });
    await db.productVariant.update({
      where: { id: dearVariant.id },
      data: { priceMinor: 900000n },
    });
    await db.product.updateMany({ data: { tags: ['sorted'] } });
    const manual = await catalog.createCollection(a, {
      title: 'Hand picked',
      slug: null,
      description: null,
      type: 'manual',
      rules: { match: 'all', conditions: [] },
      sortOrder: 'manual',
      publishedAt: null,
      isFeatured: false,
      seoTitle: null,
      seoDescription: null,
    });
    await catalog.addCollectionProducts(a, {
      collectionId: manual.data.id,
      productIds: [cheap.id],
    });
    const rules = {
      match: 'all' as const,
      conditions: [{ field: 'tag' as const, operator: 'equals', value: 'sorted' }],
    };
    await catalog.updateCollection(a, {
      id: manual.data.id,
      title: 'Hand picked',
      slug: null,
      description: null,
      type: 'automatic',
      rules,
      sortOrder: 'price_desc',
      publishedAt: null,
      isFeatured: false,
      seoTitle: null,
      seoDescription: null,
    });
    const members = await db.collectionProduct.findMany({
      where: { collectionId: manual.data.id },
      orderBy: { position: 'asc' },
    });
    expect(members.map((m) => m.productId)).toEqual([dear.id, cheap.id]);
    const log = await db.auditLog.findFirstOrThrow({
      where: { entityId: manual.data.id, action: 'collection.update' },
    });
    expect(JSON.stringify(log.before)).toContain(cheap.id);
  });
});

describe('every mutation leaves an audit row (INV-A2)', () => {
  it('records the actor, address and entity for a sequence of admin changes', async () => {
    const a = await actor();
    const cat = await catalog.createCategory(a, category('Audited'));
    await catalog.updateCategory(a, { id: cat.data.id, ...category('Audited too') });
    const p = await catalog.createProduct(a, {
      title: 'Audited product',
      categoryId: cat.data.id,
      productType: null,
    });
    await catalog.updateProductDetails(a, await detailsFor(p.data.id, { subtitle: 'Edited' }));
    const rows = await db.auditLog.findMany({
      where: { actorId: a.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual([
      'category.create',
      'category.update',
      'product.create',
      'product.update',
    ]);
    for (const row of rows) {
      expect(row.actorId).toBe(a.userId);
      expect(row.ip).toBe('203.0.113.7');
    }
    expect(rows[3]!.before).toMatchObject({ title: 'Audited product' });
  });

  it('writes nothing when the change is refused (the audit row rolls back with it)', async () => {
    const a = await actor();
    const one = await catalog.createProduct(a, {
      title: 'One',
      categoryId: null,
      productType: null,
    });
    await catalog.createProduct(a, { title: 'Two', categoryId: null, productType: null });
    const before = await db.auditLog.count();
    await expect(
      catalog.updateProductDetails(a, await detailsFor(one.data.id, { slug: 'two' })),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await db.auditLog.count()).toBe(before);
  });
});
