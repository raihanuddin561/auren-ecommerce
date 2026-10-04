import type { Locator, Page } from '@playwright/test';
import { db } from '@/lib/db';
import { expect as baseExpect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

// A development server compiles on first use, so give each wait room (a production build is fast).
const expect = baseExpect.configure({ timeout: 20_000 });

/**
 * The shop and collection pages against a real database. Each worker creates its own category of
 * 30 menswear products (and a collection), with colours, sizes, pictures and stock, then removes
 * them afterwards, so counts and orders are exact and nothing else in the database matters.
 */
test.describe.configure({ timeout: 180_000 });

const tag = `${process.pid.toString(36)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const CATEGORY_PATH = `e2e-shirts-${tag}`;
const CATEGORY_NAME = `E2E Shirts ${tag}`;
const COLLECTION_SLUG = `e2e-edit-${tag}`;
const DRAFT_COLLECTION_SLUG = `e2e-draft-${tag}`;
const SLUG_PREFIX = `e2e-${tag}-`;
const PRODUCT_COUNT = 30;
const pad = (n: number) => String(n).padStart(2, '0');
const title = (n: number) => `E2E Shirt ${pad(n)} ${tag}`;
const SHOP = `/shop/${CATEGORY_PATH}`;

let locationId = '';
let createdLocation = false;

test.beforeAll(async () => {
  const category = await db.category.create({
    data: {
      name: CATEGORY_NAME,
      slug: CATEGORY_PATH,
      path: CATEGORY_PATH,
      description: 'Shirts for the storefront tests.',
      position: 999,
    },
  });
  const existing = await db.location.findFirst({ where: { isActive: true } });
  if (existing) {
    locationId = existing.id;
  } else {
    locationId = (await db.location.create({ data: { name: `E2E warehouse ${tag}` } })).id;
    createdLocation = true;
  }

  const productIds: string[] = [];
  for (let n = 1; n <= PRODUCT_COUNT; n += 1) {
    // Odd products come in white and navy, even ones in navy only. Products 1 to 10 have size S.
    const colors = n % 2 === 1 ? ['white', 'navy'] : ['navy'];
    const sizes = n <= 10 ? ['S', 'M', 'L'] : ['M', 'L'];
    const price = BigInt(100_000 + n * 10_000); // BDT minor units: 1,100 to 4,000 taka
    const product = await db.product.create({
      data: {
        slug: `${SLUG_PREFIX}${pad(n)}`,
        title: title(n),
        subtitle: 'Test shirt',
        status: 'active',
        categoryId: category.id,
        fit: n <= 10 ? 'slim' : 'regular',
        attributes: { fabric: n % 3 === 0 ? 'Linen' : 'Cotton' },
        // Product 1 is the newest, product 30 the oldest (within the last 30 days).
        publishedAt: new Date(Date.now() - n * 60_000),
        featuredRank: n === 5 ? 1 : null,
        options: {
          create: [
            {
              name: 'Color',
              position: 0,
              values: {
                create: colors.map((value, position) => ({
                  value,
                  label: value === 'white' ? 'White' : 'Navy',
                  swatchHex: value === 'white' ? '#F8F8F6' : '#1F2A44',
                  position,
                })),
              },
            },
            {
              name: 'Size',
              position: 1,
              values: {
                create: sizes.map((value, position) => ({ value, label: value, position })),
              },
            },
          ],
        },
      },
      include: { options: { include: { values: true } } },
    });
    productIds.push(product.id);

    const colorOption = product.options.find((o) => o.name === 'Color')!;
    const sizeOption = product.options.find((o) => o.name === 'Size')!;
    let position = 0;
    let variantCount = 0;
    for (const color of colorOption.values) {
      for (const view of ['front', 'detail']) {
        await db.productMedia.create({
          data: {
            productId: product.id,
            optionValueId: color.id,
            url: `/seed/${color.value === 'white' ? 'white' : 'navy'}.svg`,
            alt: `${title(n)} in ${color.label}, ${view} view`,
            width: 800,
            height: 1000,
            dominantColor: color.swatchHex,
            position: position++,
          },
        });
      }
      for (const size of sizeOption.values) {
        const variant = await db.productVariant.create({
          data: {
            productId: product.id,
            sku: `E2E-${tag}-${pad(n)}-${color.value}-${size.value}`.toUpperCase(),
            priceMinor: price,
            compareAtMinor: n === 7 ? price + 50_000n : null,
            status: 'active',
            optionValues: {
              create: [{ optionValueId: color.id }, { optionValueId: size.id }],
            },
          },
        });
        // Product 30 is sold out, product 29 has one unit left; the rest are well stocked.
        const first = variantCount === 0;
        variantCount += 1;
        const onHand = n === PRODUCT_COUNT ? 0 : n === PRODUCT_COUNT - 1 ? (first ? 1 : 0) : 10;
        await db.inventoryLevel.create({ data: { variantId: variant.id, locationId, onHand } });
      }
    }
  }

  const live = await db.collection.create({
    data: {
      slug: COLLECTION_SLUG,
      title: `E2E Edit ${tag}`,
      description: 'A hand-picked edit for the tests.',
      type: 'manual',
      sortOrder: 'manual',
      publishedAt: new Date(Date.now() - 3_600_000),
    },
  });
  // Manual order: 9, 3, 7 (not the featured or newest order).
  for (const [position, n] of [9, 3, 7].entries()) {
    await db.collectionProduct.create({
      data: { collectionId: live.id, productId: productIds[n - 1]!, position },
    });
  }
  await db.collection.create({
    data: { slug: DRAFT_COLLECTION_SLUG, title: `E2E Draft ${tag}`, publishedAt: null },
  });
});

test.afterAll(async () => {
  await db.collection.deleteMany({
    where: { slug: { in: [COLLECTION_SLUG, DRAFT_COLLECTION_SLUG] } },
  });
  await db.inventoryLevel.deleteMany({
    where: { variant: { product: { slug: { startsWith: SLUG_PREFIX } } } },
  });
  await db.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await db.category.deleteMany({ where: { path: CATEGORY_PATH } });
  if (createdLocation) await db.location.deleteMany({ where: { id: locationId } });
});

// Cards carry data-stock once the live stock has been merged in (the streamed island).
const cards = (page: Page) => page.locator('article[data-stock]');
const progress = (page: Page, shown: number, total: number) =>
  page.getByText(`Showing ${shown} of ${total} pieces`);

async function applyFilters(page: Page, choose: (drawer: Locator) => Promise<void>) {
  await page.getByRole('button', { name: /^Filter/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Filters' });
  await expect(drawer).toBeVisible();
  await choose(drawer);
  await drawer.getByRole('button', { name: 'Apply filters' }).click();
  await expect(drawer).toBeHidden();
}

test.describe('shop page', () => {
  test('lists the category with its header, 24 cards, breadcrumb and structured data', async ({
    page,
  }) => {
    const response = await page.goto(SHOP);
    expect(response!.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: CATEGORY_NAME })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Shop');
    await expect(cards(page)).toHaveCount(24);
    await expect(progress(page, 24, PRODUCT_COUNT)).toBeVisible();

    // Every card is one link to its product page.
    await expect(cards(page).first().getByRole('link')).toHaveAttribute(
      'href',
      /^\/products\/e2e-/,
    );

    const graph = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    const entry = graph['@graph'][0];
    expect(entry['@type']).toBe('CollectionPage');
    expect(entry.mainEntity['@type']).toBe('ItemList');
    expect(entry.mainEntity.numberOfItems).toBe(24);
    expect(entry.breadcrumb['@type']).toBe('BreadcrumbList');
  });

  test('lists everything on /shop and finds nothing at an unknown path', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1, name: 'Shop all' })).toBeVisible();
    await expect(cards(page).first()).toBeVisible();

    await page.goto('/shop/does-not-exist');
    await expect(page.getByRole('heading', { name: 'This page has stepped out' })).toBeVisible();
  });

  test('puts a colour and a size choice in the address and narrows the results', async ({
    page,
  }) => {
    await page.goto(SHOP);
    await applyFilters(page, async (drawer) => {
      await drawer.getByRole('button', { name: /^White,/ }).click();
    });
    await expect(page).toHaveURL(/color=white/);
    await expect(progress(page, 15, 15)).toBeVisible();
    await expect(cards(page)).toHaveCount(15);

    await applyFilters(page, async (drawer) => {
      await drawer.getByRole('button', { name: /^S,/ }).click();
    });
    await expect(page).toHaveURL(/size=S/);
    await expect(page).toHaveURL(/color=white/);
    // White shirts that come in S: products 1, 3, 5, 7 and 9.
    await expect(progress(page, 5, 5)).toBeVisible();
    await expect(cards(page)).toHaveCount(5);

    // The filter bar shows the count and a link removes one filter.
    await expect(page.getByRole('button', { name: /^Filter/ })).toContainText('2');
    await page.getByRole('link', { name: /Size S/ }).click();
    await expect(page).not.toHaveURL(/size=/);
    await expect(progress(page, 15, 15)).toBeVisible();
  });

  test('is the same page when the address is opened directly', async ({ page }) => {
    await page.goto(`${SHOP}?color=white&size=S&size=M`);
    await expect(cards(page)).toHaveCount(15);
    await expect(page.getByRole('button', { name: /^Filter/ })).toContainText('3');
  });

  test('sorts by price in both directions and by newest, in the address', async ({ page }) => {
    await page.goto(SHOP);
    const sort = page.getByRole('combobox', { name: 'Sort by' });
    await sort.click();
    await page.getByRole('option', { name: 'Price, high to low' }).click();
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(cards(page).first()).toContainText(title(30));

    await sort.click();
    await page.getByRole('option', { name: 'Price, low to high' }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(cards(page).first()).toContainText(title(1));

    await sort.click();
    await page.getByRole('option', { name: 'Newest' }).click();
    await expect(page).toHaveURL(/sort=newest/);
    await expect(cards(page).first()).toContainText(title(1));
  });

  test('puts the featured product first by default', async ({ page }) => {
    await page.goto(SHOP);
    await expect(cards(page).first()).toContainText(title(5));
  });

  test('hides sold out products when only in stock is chosen', async ({ page }) => {
    await page.goto(SHOP);
    // Sold out stays listed, with a badge, until the filter is on.
    await page.goto(`${SHOP}?page=2`);
    const soldOut = cards(page).filter({ hasText: title(30) });
    await expect(soldOut).toContainText('Sold out');

    await page.goto(SHOP);
    await applyFilters(page, async (drawer) => {
      await drawer.getByRole('switch', { name: 'In stock only' }).click();
    });
    await expect(page).toHaveURL(/instock=1/);
    await expect(progress(page, 24, PRODUCT_COUNT - 1)).toBeVisible();
    await page.goto(`${SHOP}?instock=1&page=2`);
    await expect(cards(page)).toHaveCount(5);
    await expect(cards(page).filter({ hasText: title(30) })).toHaveCount(0);
  });

  test('marks a nearly gone product with Low stock', async ({ page }) => {
    await page.goto(`${SHOP}?page=2`);
    await expect(cards(page).filter({ hasText: title(29) })).toContainText('Low stock');
  });

  test('loads more products in place, and offers crawlable page links', async ({
    page,
    request,
  }) => {
    // Page links are real anchors in the server HTML, with no JavaScript needed.
    const html = await (await request.get(SHOP)).text();
    expect(html).toContain(`href="${SHOP}?page=2"`);
    expect(html).toContain('rel="next"');
    expect(html).not.toContain('rel="prev"');

    await page.goto(SHOP);
    await expect(cards(page)).toHaveCount(24);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(cards(page)).toHaveCount(PRODUCT_COUNT);
    await expect(progress(page, PRODUCT_COUNT, PRODUCT_COUNT)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  });

  test('keeps the loaded products when coming back from a product', async ({ page }) => {
    await page.goto(SHOP);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(cards(page)).toHaveCount(PRODUCT_COUNT);
    const last = cards(page).last();
    await last.scrollIntoViewIfNeeded();
    await last.getByRole('link').click();
    await expect(page).toHaveURL(/\/products\//);
    await page.goBack();
    await expect(cards(page)).toHaveCount(PRODUCT_COUNT);
  });

  test('page 2 has its own address, previous and next links, and a self canonical', async ({
    page,
    request,
  }) => {
    await page.goto(`${SHOP}?page=2`);
    await expect(cards(page)).toHaveCount(6);
    await expect(page.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', SHOP);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${SHOP}\\?page=2$`),
    );
    const html = await (await request.get(`${SHOP}?page=2`)).text();
    expect(html).toContain('rel="prev"');
    expect(html).not.toContain('content="noindex');

    // A page past the end is not found.
    await page.goto(`${SHOP}?page=9`);
    await expect(page.getByRole('heading', { name: 'This page has stepped out' })).toBeVisible();
  });

  test('canonical and robots follow the faceted URL rules', async ({ request }) => {
    const robots = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
    const canonical = (html: string) => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];

    const plain = await (await request.get(SHOP)).text();
    expect(robots(plain)).toContain('index');
    expect(robots(plain)).not.toContain('noindex');
    expect(canonical(plain)).toMatch(new RegExp(`${SHOP}$`));

    const colour = await (await request.get(`${SHOP}?color=white`)).text();
    expect(robots(colour)).not.toContain('noindex');
    expect(canonical(colour)).toMatch(/\?color=white$/);

    const deep = await (await request.get(`${SHOP}?color=white&size=M&sort=newest`)).text();
    expect(robots(deep)).toContain('noindex');
    expect(robots(deep)).toContain('follow');
    expect(canonical(deep)).toMatch(new RegExp(`${SHOP}$`));
  });

  test('shows the empty state with a way back, and new arrivals', async ({ page }) => {
    await page.goto(`${SHOP}?color=white&fit=relaxed`);
    await expect(page.getByText('No pieces match these filters')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New arrivals' })).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/color=/);
    await expect(cards(page)).toHaveCount(24);
  });

  test('ignores nonsense in the address instead of failing', async ({ page }) => {
    const response = await page.goto(
      `${SHOP}?sort=cheapest&page=abc&size=&min=x&density=99&evil=1`,
    );
    expect(response!.status()).toBe(200);
    await expect(cards(page)).toHaveCount(24);
  });

  test('switches the grid density through the address', async ({ page, isMobile }) => {
    await page.goto(SHOP);
    const columns = () =>
      page
        .getByRole('list', { name: `${CATEGORY_NAME} products` })
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    if (isMobile) {
      await expect.poll(columns).toBe(2);
      await page.getByRole('button', { name: '1 column' }).click();
      await expect(page).toHaveURL(/density=1/);
      await expect.poll(columns).toBe(1);
    } else {
      await expect.poll(columns).toBe(4);
      await page.getByRole('button', { name: '2 columns' }).click();
      await expect(page).toHaveURL(/density=2/);
      await expect.poll(columns).toBe(2);
    }
  });
});

test.describe('product card', () => {
  test('a colour swatch switches the picture of the card', async ({ page }) => {
    await page.goto(SHOP);
    const card = cards(page).filter({ hasText: title(5) });
    await expect(card.getByRole('img', { name: /in White, front view/ })).toBeVisible();
    const navy = card.getByRole('button', { name: 'Navy', exact: true });
    await navy.click();
    await expect(navy).toHaveAttribute('aria-pressed', 'true');
    await expect(card.getByRole('img', { name: /in Navy, front view/ })).toBeVisible();
    // Colour never changes where the card leads.
    await expect(card.getByRole('link')).toHaveAttribute('href', `/products/${SLUG_PREFIX}05`);
  });

  test('shows New and a struck-through compare-at price', async ({ page }) => {
    await page.goto(SHOP);
    const card = cards(page).filter({ hasText: title(7) });
    await expect(card).toContainText('New');
    await expect(card.locator('s')).toBeVisible();
  });

  test('quick add on desktop offers the sizes and answers honestly', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Quick add is for pointer devices');
    await page.goto(SHOP);
    const card = cards(page).filter({ hasText: title(5) });
    await card.hover();
    const sizes = card.getByRole('group', { name: /Quick add/ });
    await expect(sizes).toBeVisible();
    await sizes.getByRole('button', { name: 'Add size M to bag' }).click();
    // The bag does not exist yet: the message says so and does not claim anything was added.
    await expect(page.getByText('The bag is coming soon')).toBeVisible();
    await expect(page.getByText(/Added to your bag/)).toHaveCount(0);
  });

  test('quick add is reachable with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Quick add is for pointer devices');
    await page.goto(SHOP);
    const card = cards(page).filter({ hasText: title(5) });
    await card.getByRole('button', { name: /to wishlist/ }).focus();
    await page.keyboard.press('Tab');
    await expect(card.getByRole('button', { name: 'Add size S to bag' })).toBeFocused();
    await expect(card.getByRole('group', { name: /Quick add/ })).toBeVisible();
  });

  test('the wishlist heart toggles and remembers', async ({ page }) => {
    await page.goto(SHOP);
    const card = cards(page).first();
    const heart = card.getByRole('button', { name: /to wishlist/ });
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await heart.click();
    await expect(card.getByRole('button', { name: /Remove .* from wishlist/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await expect(
      cards(page)
        .first()
        .getByRole('button', { name: /Remove .* from wishlist/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('collection page', () => {
  test('lists the members in their manual order', async ({ page }) => {
    await page.goto(`/collections/${COLLECTION_SLUG}`);
    await expect(page.getByRole('heading', { level: 1, name: `E2E Edit ${tag}` })).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).nth(0)).toContainText(title(9));
    await expect(cards(page).nth(1)).toContainText(title(3));
    await expect(cards(page).nth(2)).toContainText(title(7));

    // The visitor can still sort it.
    await page.getByRole('combobox', { name: 'Sort by' }).click();
    await page.getByRole('option', { name: 'Price, high to low' }).click();
    await expect(cards(page).first()).toContainText(title(9));
    await expect(cards(page).last()).toContainText(title(3));
  });

  test('does not show a draft collection or an unknown one', async ({ page }) => {
    for (const slug of [DRAFT_COLLECTION_SLUG, 'no-such-collection']) {
      await page.goto(`/collections/${slug}`);
      await expect(page.getByRole('heading', { name: 'This page has stepped out' })).toBeVisible();
    }
  });
});

test.describe('search page', () => {
  test('is a plain form that is not indexed', async ({ page, request }) => {
    const html = await (await request.get('/search?q=oxford')).text();
    expect(html).toContain('noindex');

    await page.goto('/search');
    await page.getByLabel('Search AUREN').fill('oxford');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\?q=oxford$/);
    await expect(page.getByText(/Search is on its way/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the header search icon leads there', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search$/);
  });
});

test.describe('accessibility', () => {
  test('has no serious violations at 375, 768 and 1440 on the shop and a filtered page', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The three widths are covered in one run');
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
      for (const url of [SHOP, `${SHOP}?color=white&size=S`]) {
        await page.goto(url);
        await expect(cards(page).first()).toBeVisible();
        await expectNoAxeViolations(page);
      }
    }
  });

  test('the filter drawer has no serious violations', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Checked once, at desktop width');
    await page.goto(SHOP);
    await page.getByRole('button', { name: /^Filter/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
  });

  test('the empty state and the collection page have no serious violations', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Checked once, at desktop width');
    await page.goto(`${SHOP}?color=white&fit=relaxed`);
    await expect(page.getByText('No pieces match these filters')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto(`/collections/${COLLECTION_SLUG}`);
    await expect(cards(page).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
