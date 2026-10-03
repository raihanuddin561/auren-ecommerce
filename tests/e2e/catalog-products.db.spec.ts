import sharp from 'sharp';
import { db } from '@/lib/db';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

// These flows sign in, render several console pages and write to a real database.
test.describe.configure({ timeout: 180_000 });

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 160, height: 200, channels: 3, background: '#a05030' } })
    .png()
    .toBuffer();
}

test.describe('products admin', () => {
  test('creates a draft, generates variants, uploads an image with alt text and publishes', async ({
    staffPage,
  }) => {
    const page = await staffPage({ role: 'owner' });
    const title = `Oxford ${unique()}`;
    const category = await db.category.create({
      data: { name: `Shirts ${unique()}`, slug: `shirts-${unique()}`, path: `shirts-${unique()}` },
    });

    await page.goto('/admin/products');
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto('/admin/products/new');
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    const id = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

    // Publishing is refused while the product is not ready, with the reasons.
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Add at least one active variant.', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Category (set through the database: the select is covered by its own unit tests).
    await db.product.update({ where: { id }, data: { categoryId: category.id } });

    // Option matrix: Size S and M with a default price typed as text.
    await page.getByRole('button', { name: 'Add option' }).click();
    await page.getByLabel('Option name').fill('Size');
    await page.getByLabel('Add a size value').fill('S');
    await page.getByRole('button', { name: 'Add value' }).click();
    await page.getByLabel('Add a size value').fill('M');
    await page.getByRole('button', { name: 'Add value' }).click();
    await page.getByLabel('SKU prefix').fill('OXF');
    await page.getByLabel(/^Price/).fill('2,490.50');
    await expect(page.getByText(/2 variants will be created/)).toBeVisible();
    await page.getByRole('button', { name: 'Generate variants' }).click();
    await expect
      .poll(() => db.productVariant.count({ where: { productId: id } }), { timeout: 60_000 })
      .toBe(2);

    const variants = await db.productVariant.findMany({ where: { productId: id } });
    expect(variants.map((v) => v.priceMinor)).toEqual([249050n, 249050n]);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(2);

    // Upload: alt text is required before the button enables.
    await page.setInputFiles('input[type="file"]', {
      name: 'front.png',
      mimeType: 'image/png',
      buffer: await png(),
    });
    await expect(page.getByRole('button', { name: /Upload 1 image/ })).toBeDisabled();
    await page
      .getByLabel(/Alt text/)
      .first()
      .fill('Oxford shirt, front view');
    await page.getByRole('button', { name: /Upload 1 image/ }).click();
    await expect(page.getByAltText('Oxford shirt, front view').first()).toBeVisible({
      timeout: 60_000,
    });
    await expect
      .poll(() => db.productMedia.count({ where: { productId: id } }), { timeout: 60_000 })
      .toBe(1);
    const media = await db.productMedia.findFirstOrThrow({ where: { productId: id } });
    expect(media.alt).toBe('Oxford shirt, front view');
    expect(media.storageKey).toMatch(/^products\/[A-Za-z0-9_-]{20,}\.webp$/);

    await page.reload();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect
      .poll(async () => (await db.product.findUniqueOrThrow({ where: { id } })).status, {
        timeout: 60_000,
      })
      .toBe('active');

    const actions = (await db.auditLog.findMany({ where: { entityId: id } })).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'product.create',
        'product.variants_generate',
        'product.status_change',
      ]),
    );
  });

  test('refuses a duplicate SKU on one row of the variants table', async ({ staffPage }) => {
    const page = await staffPage({ role: 'owner' });
    const product = await db.product.create({
      data: { slug: `p-${unique()}`, title: 'Dup SKU test' },
    });
    const sku = `DUP-${unique()}`.toUpperCase();
    await db.productVariant.createMany({
      data: [
        { productId: product.id, sku, priceMinor: 100000n, position: 0, isDefault: true },
        { productId: product.id, sku: `${sku}-B`, priceMinor: 100000n, position: 1 },
      ],
    });
    await page.goto(`/admin/products/${product.id}`);
    const rows = page.getByRole('textbox', { name: /^sku for/i });
    await rows.nth(1).fill(sku);
    await page.getByRole('button', { name: 'Save variants' }).click();
    await expect(page.getByText(/SKUs must be different|already used/).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('keeps write controls away from read-only staff', async ({ staffPage }) => {
    const page = await staffPage({ role: 'content_editor' });
    await page.goto('/admin/products');
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New product' })).toHaveCount(0);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });
});

test.describe('collections admin', () => {
  test('creates a manual collection, adds a product and moves its address with a redirect', async ({
    staffPage,
    baseURL,
  }) => {
    const page = await staffPage({ role: 'owner' });
    const title = `Linen ${unique()}`;
    const product = await db.product.create({
      data: {
        slug: `lc-${unique()}`,
        title: `Collectable ${unique()}`,
        status: 'active',
        publishedAt: new Date(),
      },
    });

    await page.goto('/admin/collections');
    await expect(page.getByRole('heading', { name: 'Collections', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto('/admin/collections/new');
    await page.getByLabel('Title').first().fill(title);
    await page.getByRole('radio', { name: /Publish now/ }).check();
    await page.getByRole('button', { name: 'Create collection' }).click();
    await expect(page).toHaveURL(/\/admin\/collections\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    const id = page.url().split('/').pop()!;

    await page
      .getByRole('searchbox')
      .or(page.getByLabel(/Search products/i))
      .first()
      .fill(product.title);
    await page
      .getByRole('checkbox', { name: new RegExp(product.title) })
      .check({ timeout: 30_000 });
    await page.getByRole('button', { name: /^Add/ }).first().click();
    await expect(page.getByText(product.title).first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => db.collectionProduct.count({ where: { collectionId: id } }), { timeout: 30_000 })
      .toBe(1);

    const row = await db.collection.findUniqueOrThrow({ where: { id } });
    await page.locator('input[name="slug"]:visible').fill(`${row.slug}-2`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Collection saved|saved/i).first()).toBeVisible({
      timeout: 60_000,
    });
    // The proxy keeps a short-lived snapshot of the redirects table (15 s), so allow for it.
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`${baseURL}/collections/${row.slug}`, {
            maxRedirects: 0,
          });
          return `${response.status()} ${new URL(response.headers().location ?? '', baseURL).pathname}`;
        },
        { timeout: 45_000, intervals: [2_000] },
      )
      .toBe(`301 /collections/${row.slug}-2`);
  });

  test('previews an automatic collection from its rules', async ({ staffPage }) => {
    const page = await staffPage({ role: 'owner' });
    const tag = `tag${unique()}`;
    await db.product.create({
      data: {
        slug: `a-${unique()}`,
        title: 'Tagged',
        status: 'active',
        publishedAt: new Date(),
        tags: [tag],
      },
    });
    await page.goto('/admin/collections/new');
    await page.getByLabel('Title').first().fill(`Auto ${tag}`);
    await page.getByRole('radio', { name: /Automatic/ }).check();
    await page.getByRole('button', { name: /Add (a )?rule|Add condition/i }).click();
    await page.getByLabel('Value').first().fill(tag);
    await expect(page.getByText(/1 product matches|1 products? match/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('only staff who can publish may publish', async ({ staffPage }) => {
    const page = await staffPage({ role: 'content_editor' });
    await page.goto('/admin/collections/new');
    // content_editor has no catalog.write: the screen is closed to them.
    await expect(page.getByRole('heading', { name: /stepped out/i })).toBeVisible();
  });
});
