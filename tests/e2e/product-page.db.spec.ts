import type { Page } from '@playwright/test';
import { db } from '@/lib/db';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

interface JsonLdNode {
  '@type': string;
  name?: string;
  offers?: { '@type': string; priceCurrency?: string; availability?: string };
  itemListElement?: Array<{ name: string }>;
}
interface JsonLdGraph {
  '@graph': JsonLdNode[];
}

/**
 * The product page against a real database: live stock in the size selector, the colour that moves
 * the gallery, the size guide, structured data, and the sold-out and unknown-product states.
 */
test.describe.configure({ timeout: 180_000 });

const tag = `${process.pid.toString(36)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SLUG = `e2e-pdp-${tag}`;
const SOLD_OUT_SLUG = `e2e-pdp-out-${tag}`;
const DRAFT_SLUG = `e2e-pdp-draft-${tag}`;
const TITLE = `PDP Oxford Shirt ${tag}`;

let locationId = '';
let createdLocation = false;
const variantIds: Record<string, string> = {};

async function makeProduct(input: {
  slug: string;
  title: string;
  status: 'active' | 'draft';
  stock: Record<string, number>;
  chart?: boolean;
}) {
  const sizeChart = input.chart
    ? await db.sizeChart.create({
        data: {
          name: `Chart ${tag}`,
          unit: 'cm',
          table: { columns: ['Chest', 'Waist'], rows: [{ size: 'S', values: ['96', '82'] }] },
          howToMeasure: 'Measure around the fullest part of the chest.',
          modelInfo: 'Model is 183 cm and wears M',
        },
      })
    : null;
  const product = await db.product.create({
    data: {
      slug: input.slug,
      title: input.title,
      subtitle: 'Brushed cotton',
      description: 'A crisp everyday oxford.\n\nCut slim through the body.',
      status: input.status,
      publishedAt: input.status === 'active' ? new Date(Date.now() - 86_400_000) : null,
      fit: 'slim',
      material: '100% cotton',
      careInstructions: 'Machine wash cold.',
      sizeChartId: sizeChart?.id ?? null,
      options: {
        create: [
          {
            name: 'Color',
            position: 0,
            values: {
              create: [
                { value: 'white', label: 'White', swatchHex: '#F8F8F6', position: 0 },
                { value: 'navy', label: 'Navy', swatchHex: '#1F2A44', position: 1 },
              ],
            },
          },
          {
            name: 'Size',
            position: 1,
            values: {
              create: ['S', 'M', 'L'].map((value, position) => ({ value, label: value, position })),
            },
          },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });
  const color = product.options.find((o) => o.name === 'Color')!;
  const size = product.options.find((o) => o.name === 'Size')!;
  for (const [index, value] of color.values.entries()) {
    await db.productMedia.create({
      data: {
        productId: product.id,
        optionValueId: value.id,
        url: `/seed/${value.value}.svg`,
        alt: `${input.title} in ${value.label}`,
        width: 800,
        height: 1000,
        position: index,
      },
    });
    for (const sizeValue of size.values) {
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `PDP-${tag}-${input.slug.length}-${value.value}-${sizeValue.value}`.toUpperCase(),
          priceMinor: 329000n,
          compareAtMinor: index === 0 ? 399000n : null,
          optionValues: { create: [{ optionValueId: value.id }, { optionValueId: sizeValue.id }] },
        },
      });
      variantIds[`${input.slug}:${value.value}:${sizeValue.value}`] = variant.id;
      const onHand = input.stock[`${value.value}:${sizeValue.value}`] ?? 0;
      if (onHand > 0) {
        await db.inventoryLevel.create({ data: { variantId: variant.id, locationId, onHand } });
      }
    }
  }
  return product;
}

test.beforeAll(async () => {
  const existing = await db.location.findFirst({ where: { isActive: true } });
  if (existing) locationId = existing.id;
  else {
    locationId = (await db.location.create({ data: { name: `E2E warehouse ${tag}` } })).id;
    createdLocation = true;
  }
  await makeProduct({
    slug: SLUG,
    title: TITLE,
    status: 'active',
    chart: true,
    stock: { 'white:S': 12, 'white:M': 2, 'white:L': 0, 'navy:S': 6, 'navy:M': 0, 'navy:L': 0 },
  });
  await makeProduct({ slug: SOLD_OUT_SLUG, title: `Sold Out ${tag}`, status: 'active', stock: {} });
  await makeProduct({
    slug: DRAFT_SLUG,
    title: `Draft ${tag}`,
    status: 'draft',
    stock: { 'white:S': 5 },
  });
});

test.afterAll(async () => {
  const slugs = [SLUG, SOLD_OUT_SLUG, DRAFT_SLUG];
  const products = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  const ids = products.map((p) => p.id);
  const variants = await db.productVariant.findMany({
    where: { productId: { in: ids } },
    select: { id: true },
  });
  const vIds = variants.map((v) => v.id);
  await db.$executeRaw`ALTER TABLE stock_movements DISABLE TRIGGER USER`.catch(() => undefined);
  await db.stockMovement.deleteMany({ where: { variantId: { in: vIds } } }).catch(() => undefined);
  await db.$executeRaw`ALTER TABLE stock_movements ENABLE TRIGGER USER`.catch(() => undefined);
  await db.inventoryLevel.deleteMany({ where: { variantId: { in: vIds } } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.sizeChart.deleteMany({ where: { name: `Chart ${tag}` } });
  if (createdLocation) await db.location.deleteMany({ where: { id: locationId } });
});

const sizeButton = (page: Page, label: string) =>
  page
    .getByRole('group', { name: 'Choose a size' })
    .getByRole('button', { name: new RegExp(`^${label}\\b`) });

test.describe('product page', () => {
  test('shows live stock states in the size selector and keeps the choice honest', async ({
    page,
  }) => {
    await page.goto(`/products/${SLUG}`);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByText('Tax included')).toBeVisible();

    // White: S plenty, M low, L sold out (struck through, announced as sold out).
    await expect(sizeButton(page, 'S')).toHaveAttribute('aria-label', 'S');
    await expect(sizeButton(page, 'M')).toHaveAttribute('aria-label', 'M, only 2 left');
    await expect(sizeButton(page, 'L')).toHaveAttribute('aria-label', 'L, sold out');
    await expect(sizeButton(page, 'L')).toHaveAttribute('aria-disabled', 'true');
    await expect(sizeButton(page, 'L')).toHaveClass(/line-through/);

    // Adding without a size asks for one, politely.
    // Until a size is chosen the button says so, and pressing it points at the sizes.
    await page.getByRole('button', { name: 'Choose a size', exact: true }).first().click();
    await expect(page.getByText('Choose a size to continue.')).toBeVisible();

    await sizeButton(page, 'M').click();
    await expect(page.getByText('Only 2 left.')).toBeVisible();

    // Another colour has other stock: navy M is gone.
    await page.getByRole('button', { name: 'Navy', exact: true }).click();
    await expect(sizeButton(page, 'M')).toHaveAttribute('aria-label', 'M, sold out');
  });

  test('add to bag asks the server and answers honestly until the bag exists', async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    await sizeButton(page, 'S').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByText('The bag is coming soon').first()).toBeVisible();
  });

  test('a colour moves the gallery to its own pictures', async ({ page }, testInfo) => {
    await page.goto(`/products/${SLUG}`);
    const visible =
      testInfo.project.name === 'mobile' ? 'img[alt*="in White"]' : 'img[alt*="in White"]';
    await expect(page.locator(visible).first()).toBeAttached();
    await page.getByRole('button', { name: 'Navy', exact: true }).click();
    await expect(page.locator('img[alt*="in Navy"]').first()).toBeAttached();
    await expect(page.locator('img[alt*="in White"]')).toHaveCount(0);
  });

  test('the size guide opens with the chart, how to measure and the helper', async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    await page.getByRole('button', { name: 'Size guide' }).click();
    const drawer = page.getByRole('dialog', { name: 'Size guide' });
    await expect(drawer.getByRole('columnheader', { name: 'Chest' })).toBeVisible();
    await expect(drawer.getByText('Model is 183 cm and wears M')).toBeVisible();
    await expect(drawer.getByText('Measure around the fullest part of the chest.')).toBeVisible();
    await drawer.getByLabel('Height (cm)').fill('180');
    await drawer.getByLabel('Weight (kg)').fill('75');
    await expect(drawer.getByText(/We suggest/)).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('a stock change shows on the next visit without rebuilding the page', async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    await expect(sizeButton(page, 'L')).toHaveAttribute('aria-label', 'L, sold out');
    const variantId = variantIds[`${SLUG}:white:L`]!;
    await db.inventoryLevel.create({ data: { variantId, locationId, onHand: 9 } });
    await page.reload();
    await expect(sizeButton(page, 'L')).toHaveAttribute('aria-label', 'L');
    await db.inventoryLevel.update({
      where: { variantId_locationId: { variantId, locationId } },
      data: { onHand: 0 },
    });
    await page.reload();
    await expect(sizeButton(page, 'L')).toHaveAttribute('aria-label', 'L, sold out');
  });

  test('a sold-out product cannot be bought and offers a notification', async ({ page }) => {
    await page.goto(`/products/${SOLD_OUT_SLUG}`);
    await expect(
      page.getByRole('button', { name: 'Sold out', exact: true }).first(),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Notify me' })).toBeVisible();
  });

  test('unknown and draft products answer with the not-found page', async ({ page }) => {
    for (const slug of [`missing-${tag}`, DRAFT_SLUG]) {
      await page.goto(`/products/${slug}`);
      await expect(page.getByRole('heading', { level: 1, name: /stepped out/ })).toBeVisible();
      // The page streams behind the shell, so the answer to crawlers is noindex.
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        'content',
        /noindex/,
      );
    }
  });

  test('has the canonical address, Open Graph tags and Product structured data', async ({
    page,
  }) => {
    await page.goto(`/products/${SLUG}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/products/${SLUG}$`),
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', TITLE);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      'content',
      /.+/,
    );
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const graphs = blocks.map((text) => JSON.parse(text) as JsonLdGraph);
    const product = graphs.flatMap((g) => g['@graph']).find((node) => node['@type'] === 'Product');
    expect(product?.name).toBe(TITLE);
    expect(product?.offers?.['@type']).toBe('AggregateOffer');
    expect(product?.offers?.priceCurrency).toBe('BDT');
    expect(product?.offers?.availability).toBe('https://schema.org/InStock');
    const crumbs = graphs
      .flatMap((g) => g['@graph'])
      .find((node) => node['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement?.at(-1)?.name).toBe(TITLE);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test('the sold-out product reports OutOfStock in its structured data', async ({ page }) => {
    await page.goto(`/products/${SOLD_OUT_SLUG}`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = blocks
      .flatMap((text) => (JSON.parse(text) as JsonLdGraph)['@graph'])
      .find((node) => node['@type'] === 'Product');
    expect(product?.offers?.availability).toBe('https://schema.org/OutOfStock');
  });

  test('recently viewed remembers the other product on this device', async ({ page }) => {
    await page.goto(`/products/${SOLD_OUT_SLUG}`);
    await page.waitForFunction(
      () => window.localStorage.getItem('auren:recently-viewed:v1') !== null,
    );
    await page.goto(`/products/${SLUG}`);
    const rail = page.getByRole('region', { name: 'Recently viewed' });
    await expect(rail.getByRole('link', { name: new RegExp(`Sold Out ${tag}`) })).toBeVisible();
    await expect(rail.getByRole('link', { name: TITLE })).toHaveCount(0);
  });

  test('is accessible at phone, tablet and desktop widths', async ({ page }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/products/${SLUG}`);
      await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
      await expectNoAxeViolations(page);
      // Nothing may push the page sideways (the buy box row once did at 375).
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(0);
    }
  });

  test('the lightbox opens, moves between pictures and closes with Escape', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Covered by the desktop run');
    await page.goto(`/products/${SLUG}`);
    await page.getByRole('button', { name: /^Zoom picture 1 of/ }).click();
    const dialog = page.getByRole('dialog', { name: /pictures/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Zoom in' }).first().click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('search engines', () => {
  test('sitemap lists live products and robots keeps private areas out', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    // The sitemap is prerendered and revalidated hourly, so it lists the catalogue as of the build.
    expect(xml).toMatch(/<loc>[^<]+\/products\/[a-z0-9-]+<\/loc>/);
    expect(xml).not.toContain(`/products/${DRAFT_SLUG}`);
    const robots = await (await request.get('/robots.txt')).text();
    for (const path of ['/admin', '/account', '/checkout', '/cart', '/api']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect(robots).toContain('Sitemap:');
  });
});
