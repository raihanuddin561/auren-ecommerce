import type { Page } from '@playwright/test';
import { db } from '@/lib/db';
import { receive } from '@/modules/inventory/service';
import { ensureReferenceData } from '@/modules/shipping/service';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

/**
 * The whole order flow against a real database, on a phone and on a desktop: pick a size and
 * colour, add to the bag, check out as a guest with cash on delivery, land on the confirmation,
 * then see the order in the admin as "awaiting verification" with the stock taken.
 */
test.describe.configure({ timeout: 240_000 });

const tag = `${process.pid.toString(36)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// Each worker gets its own network address so order limits and rate limits never cross runs.
const address = () =>
  `198.19.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
test.use({ extraHTTPHeaders: { 'x-forwarded-for': address() } });

let counter = 0;
const created: { productIds: string[]; variantIds: string[] } = { productIds: [], variantIds: [] };

async function ensureLocation(): Promise<void> {
  if (!(await db.location.findFirst({ where: { isActive: true } }))) {
    await db.location.create({ data: { name: `E2E warehouse ${tag}`, isDefault: true } });
  }
}

interface MadeProduct {
  slug: string;
  title: string;
  /** Variant ids by "Ivory/M". */
  variants: Record<string, string>;
}

/** A published product with Colour and Size, a cost on every variant, and stock received through the service. */
async function makeProduct(stock = 10, priceMinor = 250000n): Promise<MadeProduct> {
  const n = ++counter;
  const slug = `e2e-checkout-${tag}-${n}`;
  const title = `Oxford shirt ${tag} ${n}`;
  const product = await db.product.create({
    data: {
      slug,
      title,
      status: 'active',
      publishedAt: new Date(Date.now() - 86_400_000),
      options: {
        create: [
          {
            name: 'Color',
            position: 0,
            values: {
              create: [
                { value: 'ivory', label: 'Ivory', swatchHex: '#F4EFE6', position: 0 },
                { value: 'navy', label: 'Navy', swatchHex: '#1F2A44', position: 1 },
              ],
            },
          },
          {
            name: 'Size',
            position: 1,
            values: {
              create: ['S', 'M'].map((value, position) => ({ value, label: value, position })),
            },
          },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });
  created.productIds.push(product.id);
  const color = product.options.find((o) => o.name === 'Color')!;
  const size = product.options.find((o) => o.name === 'Size')!;
  const variants: Record<string, string> = {};
  for (const [index, colour] of color.values.entries()) {
    await db.productMedia.create({
      data: {
        productId: product.id,
        optionValueId: colour.id,
        url: `/seed/${colour.value === 'ivory' ? 'sand' : 'charcoal'}.svg`,
        alt: `${title} in ${colour.label}`,
        width: 800,
        height: 1000,
        position: index,
      },
    });
    for (const s of size.values) {
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `CO-${tag}-${n}-${colour.value}-${s.value}`.toUpperCase(),
          priceMinor,
          avgCostMinor: 90000n,
          optionValues: { create: [{ optionValueId: colour.id }, { optionValueId: s.id }] },
        },
      });
      variants[`${colour.label}/${s.label}`] = variant.id;
      created.variantIds.push(variant.id);
      if (stock > 0) {
        await db.$transaction((tx) =>
          receive(tx, {
            variantId: variant.id,
            quantity: stock,
            unitCostMinor: 90000n,
            referenceType: 'e2e',
            referenceId: `${tag}-${variant.id}`,
          }),
        );
      }
    }
  }
  return { slug, title, variants };
}

test.beforeAll(async () => {
  await ensureLocation();
  await db.$transaction((tx) => ensureReferenceData(tx), { timeout: 60_000 });
});

test.afterAll(async () => {
  // Best effort: orders and ledgers are append-only for the app, so the throwaway database is
  // cleared with the ledger triggers off (table owner). A leftover row only costs a little disk.
  try {
    const orders = await db.orderItem.findMany({
      where: { variantId: { in: created.variantIds } },
      select: { orderId: true },
    });
    const orderIds = [...new Set(orders.map((o) => o.orderId))];
    const ledgers = ['order_events', 'stock_movements', 'notification_logs'];
    for (const table of ledgers) {
      await db.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
    }
    try {
      await db.notificationLog.deleteMany({ where: { relatedId: { in: orderIds } } });
      await db.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
      await db.stockMovement.deleteMany({ where: { variantId: { in: created.variantIds } } });
      await db.stockReservation.deleteMany({ where: { variantId: { in: created.variantIds } } });
      await db.inventoryLevel.deleteMany({ where: { variantId: { in: created.variantIds } } });
      await db.cartItem.deleteMany({ where: { variantId: { in: created.variantIds } } });
      await db.productVariant.deleteMany({ where: { id: { in: created.variantIds } } });
      await db.product.deleteMany({ where: { id: { in: created.productIds } } });
    } finally {
      for (const table of ledgers) {
        await db.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
      }
    }
  } catch {
    // leave it
  }
});

const sizeButton = (page: Page, label: string) =>
  page
    .getByRole('group', { name: 'Choose a size' })
    .getByRole('button', { name: new RegExp(`^${label}\\b`) });

// Scoped to the checkout form: the storefront page the visitor came from can stay mounted (hidden)
// behind it, with its own newsletter field.
const checkoutForm = (page: Page) => page.getByRole('form', { name: 'Checkout' });

async function fillContact(page: Page, phone: string) {
  const form = checkoutForm(page);
  await form.getByLabel(/Mobile number/).fill(phone);
  await form.getByLabel(/Full name/).fill('Ayaan Rahman');
  await form.getByLabel(/^Email/).fill('ayaan@example.com');
}

async function fillAddress(page: Page) {
  const form = checkoutForm(page);
  await form.getByLabel(/^Division/).selectOption({ label: 'Dhaka' });
  await form.getByLabel(/^District/).selectOption({ label: 'Dhaka' });
  await form.getByLabel(/Thana or upazila/).selectOption({ label: 'Mirpur' });
  await form.getByLabel(/Area or neighbourhood/).fill('Section 10');
  await form.getByLabel(/House, road and landmark/).fill('House 12, Road 4, near the green mosque');
}

// E2E_SHOTS=1 writes full-page screenshots for the visual review (never part of a normal run).
const SHOTS = process.env.E2E_SHOTS === '1';
async function shot(page: Page, name: string, width?: number) {
  if (!SHOTS) return;
  if (width) await page.setViewportSize({ width, height: 1000 });
  await page.screenshot({ path: `tests/e2e/__qa__/shots/${name}.png`, fullPage: true });
}

const uniquePhone = () => `0171${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;

test.describe('bag', () => {
  test('quantity, remove with undo, save for later and the free delivery bar', async ({ page }) => {
    const product = await makeProduct(10, 250000n);
    await page.goto(`/products/${product.slug}`);
    await sizeButton(page, 'S').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();

    const drawer = page.getByRole('dialog', { name: /Your bag/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(product.title)).toBeVisible();
    // 2,500 of 5,000: the bar says how much is left and shows progress.
    await expect(drawer.getByText('Add ৳2,500 more for complimentary delivery.')).toBeVisible();
    await expect(drawer.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    await shot(page, `drawer-${test.info().project.name}`);
    await expectNoAxeViolations(page);

    await drawer.getByRole('link', { name: 'View bag' }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Review your pieces' })).toBeVisible();

    const increase = page.getByRole('button', { name: `Increase quantity of ${product.title}` });
    await shot(page, `cart-${test.info().project.name}`);
    await increase.click();
    await expect(page.getByText('Complimentary delivery unlocked.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bag, 2 items' })).toBeVisible();

    // Remove, then undo.
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(
      page.getByText('Your bag is empty').filter({ visible: true }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(product.title).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bag, 2 items' })).toBeVisible();

    // Save for later moves it to the wishlist on this device.
    await page.getByRole('button', { name: 'Save for later' }).click();
    await expect(
      page.getByText('Your bag is empty').filter({ visible: true }).first(),
    ).toBeVisible();
    await page.goto('/wishlist');
    await expect(page.getByText(product.title)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the bag survives a reload and refuses more than the stock', async ({ page }) => {
    const product = await makeProduct(2, 100000n);
    await page.goto(`/products/${product.slug}`);
    await sizeButton(page, 'S').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByRole('dialog', { name: /Your bag/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
    await page.goto('/cart');
    const increase = page.getByRole('button', { name: `Increase quantity of ${product.title}` });
    await increase.click();
    await expect(page.getByRole('link', { name: 'Bag, 2 items' })).toBeVisible();
    // Only two exist: the stepper stops.
    await expect(increase).toBeDisabled();
    await expect(page.getByText('Only 2 left in this size.')).toBeVisible();
  });
});

test.describe('checkout and confirmation', () => {
  test('a guest places a cash on delivery order, gets a confirmation, and the team can see it', async ({
    page,
    browser,
    baseURL,
    staffPage,
  }, testInfo) => {
    const product = await makeProduct(10, 250000n);
    const phone = uniquePhone();
    const variantId = product.variants['Ivory/M']!;

    // Product page: choose colour and size, add to bag, the drawer opens.
    await page.goto(`/products/${product.slug}`);
    await page.getByRole('button', { name: 'Ivory', exact: true }).click();
    await sizeButton(page, 'M').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    const drawer = page.getByRole('dialog', { name: /Your bag/ });
    await expect(drawer.getByText(product.title)).toBeVisible();
    await expect(drawer.getByText('Ivory / M')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Bag, 1 item' }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Checkout', exact: true }).click();

    // Checkout: wordmark only, no navigation to wander off to.
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Almost yours' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);

    // Inline validation: a wrong phone is explained on the spot and nothing is sent.
    await checkoutForm(page)
      .getByLabel(/Mobile number/)
      .fill('12345');
    await checkoutForm(page)
      .getByLabel(/Full name/)
      .focus();
    await expect(
      page
        .getByText(/Bangladesh mobile number, for example/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await fillContact(page, phone);
    await fillAddress(page);

    // Delivery comes from the server: 2,500 is below the 5,000 threshold, so Inside Dhaka is 80.
    await expect(page.getByRole('radio', { name: /Standard delivery/ })).toBeVisible();
    const total = page.locator('[data-testid="order-total"]:visible');
    await expect(total).toHaveText('৳2,580');
    await shot(page, `checkout-${test.info().project.name}`);
    await expectNoAxeViolations(page);

    // What was typed survives a refresh.
    await page.reload();
    await expect(checkoutForm(page).getByLabel(/Mobile number/)).toHaveValue(phone);
    await expect(checkoutForm(page).getByLabel(/^District/)).toHaveValue(/.+/);
    await expect(checkoutForm(page).getByLabel(/Thana or upazila/)).toHaveValue(/.+/);
    await expect(checkoutForm(page).getByLabel(/House, road and landmark/)).toHaveValue(
      /green mosque/,
    );
    await expect(total).toHaveText('৳2,580');

    await page.getByRole('button', { name: /Place order/ }).click();

    // Confirmation: a person will confirm; the timeline starts at Placed.
    await expect(page).toHaveURL(/\/track\/[A-Za-z0-9_-]{22}\?placed=1$/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Thank you, Ayaan' })).toBeVisible();
    await expect(
      page
        .getByText(/Our team will personally confirm your order shortly/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    const timeline = page.getByRole('list', { name: 'Order progress' });
    await expect(timeline.getByRole('listitem')).toHaveText([
      /Placed/,
      /Verified/,
      /Shipped/,
      /Delivered/,
    ]);
    await expect(timeline.getByRole('listitem').first()).toHaveAttribute('aria-current', 'step');
    await expect(page.getByText(product.title).filter({ visible: true }).first()).toBeVisible();
    await expect(
      page.getByText('Cash on delivery').filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Create an account to track your orders')).toBeVisible();
    await shot(page, `confirmation-${test.info().project.name}`);
    await expectNoAxeViolations(page);

    const orderNumber = (
      await page
        .getByText(/^Order AUR-\d+$/)
        .first()
        .innerText()
    ).replace('Order ', '');
    const trackUrl = page.url().replace('?placed=1', '');

    // The database agrees: placed, not confirmed, stock taken, nothing hidden in the response.
    const order = await db.order.findUniqueOrThrow({
      where: { orderNumber },
      include: { items: true },
    });
    expect(order.status).toBe('placed');
    expect(order.confirmedBy).toBeNull();
    expect(order.totalMinor).toBe(258000n);
    expect(order.items[0]).toMatchObject({
      variantId,
      quantity: 1,
      unitPriceMinor: 250000n,
      unitCostMinor: 90000n,
    });
    const level = await db.inventoryLevel.findFirstOrThrow({ where: { variantId } });
    expect(level.onHand).toBe(9);

    // The bag is empty after ordering.
    await page.goto('/cart');
    await expect(
      page.getByText('Your bag is empty').filter({ visible: true }).first(),
    ).toBeVisible();

    // The private link in another browser asks for the phone or email first, with one generic error.
    const stranger = await browser.newContext({
      baseURL: baseURL!,
      extraHTTPHeaders: { 'x-forwarded-for': address() },
    });
    const other = await stranger.newPage();
    await other.goto(trackUrl);
    await expect(other.getByRole('heading', { level: 1, name: 'Confirm it is you' })).toBeVisible();
    await expect(other.getByText(product.title)).toHaveCount(0);
    await other.getByLabel(/Phone number or email/).fill('01799999999');
    await other.getByRole('button', { name: 'View my order' }).click();
    await expect(
      other.getByRole('alert').filter({ hasText: /could not find an order/ }),
    ).toBeVisible();
    await other.getByLabel(/Phone number or email/).fill(phone);
    await other.getByRole('button', { name: 'View my order' }).click();
    await expect(other.getByRole('heading', { level: 1, name: /Your order, Ayaan/ })).toBeVisible();
    await expect(other.getByText(product.title).filter({ visible: true }).first()).toBeVisible();
    // Order number plus phone shows the status only.
    await other.goto('/track');
    await other.getByLabel(/Order number/).fill(orderNumber);
    await other.getByLabel(/Phone number or email/).fill(phone);
    await other.getByRole('button', { name: 'Find my order' }).click();
    await expect(other.getByRole('heading', { name: 'Awaiting verification' })).toBeVisible();
    await expect(other.getByText(product.title)).toHaveCount(0);
    await stranger.close();

    // The team sees it, waiting for verification, with items, price and cost.
    const staff = await staffPage({ role: 'manager' });
    await staff.goto('/admin/orders');
    await expect(staff.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    const row = staff.getByRole('row').filter({ hasText: orderNumber });
    await expect(row).toContainText('Awaiting verification');
    await expect(row).toContainText('Ayaan Rahman');
    await expectNoAxeViolations(staff);
    await row.getByRole('link', { name: orderNumber }).click();
    await expect(staff.getByRole('heading', { level: 1, name: orderNumber })).toBeVisible();
    await expect(staff.getByText(/Awaiting verification/).first()).toBeVisible();
    const detail = staff.getByRole('table', { name: 'Items in this order' });
    await expect(detail).toContainText(product.title);
    await expect(detail).toContainText('৳2,500');
    await expect(detail).toContainText('৳900');
    await expect(staff.getByText('Mirpur').first()).toBeVisible();
    await expectNoAxeViolations(staff);

    // Stock is down by one in the inventory screen.
    await staff.goto(`/admin/inventory?q=${encodeURIComponent(product.title)}`);
    const stockRow = staff.getByRole('row').filter({ hasText: 'Ivory / M' });
    await expect(stockRow.first()).toBeVisible();
    await expect(stockRow.first().getByRole('cell').nth(2)).toHaveText(/9/);
    testInfo.annotations.push({ type: 'order', description: orderNumber });
  });

  test('an item that sells out while the form is open is explained and the bag is kept', async ({
    page,
  }) => {
    const product = await makeProduct(1, 100000n);
    await page.goto(`/products/${product.slug}`);
    await sizeButton(page, 'S').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByRole('dialog', { name: /Your bag/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/checkout');
    await fillContact(page, uniquePhone());
    await fillAddress(page);
    await expect(page.getByRole('radio', { name: /Standard delivery/ })).toBeVisible();

    // Someone else buys the last one.
    await db.inventoryLevel.updateMany({
      where: { variantId: product.variants['Ivory/S']! },
      data: { onHand: 0 },
    });
    await page.getByRole('button', { name: /Place order/ }).click();
    const alert = page.getByRole('alert').filter({ hasText: /sold out/ });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: 'Review your bag' })).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    // The bag is still there.
    await page.goto('/cart');
    await expect(page.getByText(product.title).filter({ visible: true }).first()).toBeVisible();
  });

  test('the checkout without a bag says so and offers the shop', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText('Your bag is empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore the collection' })).toBeVisible();
  });
});

test.describe('visual review', () => {
  test('tablet width screenshots of the bag, checkout and confirmation', async ({ page }) => {
    test.skip(!SHOTS, 'Only with E2E_SHOTS=1');
    const product = await makeProduct(10, 250000n);
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.goto(`/products/${product.slug}`);
    await sizeButton(page, 'S').click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByRole('dialog', { name: /Your bag/ })).toBeVisible();
    await shot(page, 'drawer-tablet');
    await page.keyboard.press('Escape');
    await page.goto('/cart');
    await expect(page.getByText(product.title).filter({ visible: true }).first()).toBeVisible();
    await shot(page, 'cart-tablet');
    await page.goto('/checkout');
    await fillContact(page, uniquePhone());
    await fillAddress(page);
    await expect(page.getByRole('radio', { name: /Standard delivery/ })).toBeVisible();
    await shot(page, 'checkout-tablet');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/track\//, { timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
    await shot(page, 'confirmation-tablet');
  });
});

test.describe('admin delivery settings', () => {
  test('the owner sees zones and rates, and a viewer without settings access does not', async ({
    staffPage,
  }) => {
    const owner = await staffPage({ role: 'owner' });
    await owner.goto('/admin/settings/shipping');
    await expect(
      owner.getByRole('heading', { level: 1, name: 'Delivery and checkout' }),
    ).toBeVisible();
    await expect(owner.getByRole('region', { name: 'Inside Dhaka' })).toBeVisible();
    await expect(owner.getByRole('region', { name: 'Outside Dhaka' })).toBeVisible();
    await expect(owner.getByLabel('Largest cash on delivery order (৳)')).toBeVisible();
    await expectNoAxeViolations(owner);

    const verifier = await staffPage({ role: 'order_verifier' });
    await verifier.goto('/admin/settings/shipping');
    // The same not-found page as any unknown address: the screen does not announce itself.
    await expect(verifier.getByRole('heading', { level: 1, name: /stepped out/ })).toBeVisible();
    await expect(verifier.getByLabel('Largest cash on delivery order (৳)')).toHaveCount(0);
  });
});
