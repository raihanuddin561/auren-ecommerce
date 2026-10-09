import type { Page } from '@playwright/test';
import { db } from '@/lib/db';
import { ensureReferenceData } from '@/modules/shipping/service';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

/**
 * The whole business in one pass, against a real database, on a desktop: stock arrives through a
 * purchase order, a customer places a cash on delivery order, a team member verifies and confirms it
 * with the checklist, the parcel is handed to a manual courier, delivered, the cash is collected,
 * and the order page shows the profit. Nothing here is faked except that the courier is typed by hand.
 */
test.describe.configure({ timeout: 360_000 });

const tag =
  `${process.pid.toString(36)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
const address = () =>
  `198.19.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
test.use({ extraHTTPHeaders: { 'x-forwarded-for': address() } });

const settle = async (page: Page) =>
  expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 });

const uniquePhone = () => `0171${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;

async function makeProduct() {
  if (!(await db.location.findFirst({ where: { isDefault: true } }))) {
    await db.location.create({ data: { name: `E2E warehouse ${tag}`, isDefault: true } });
  }
  const slug = `e2e-journey-${tag.toLowerCase()}`;
  const title = `Journey shirt ${tag}`;
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
              create: [{ value: 'ivory', label: 'Ivory', swatchHex: '#F4EFE6', position: 0 }],
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
  const color = product.options.find((o) => o.name === 'Color')!;
  const size = product.options.find((o) => o.name === 'Size')!;
  await db.productMedia.create({
    data: {
      productId: product.id,
      optionValueId: color.values[0]!.id,
      url: '/seed/sand.svg',
      alt: `${title} in Ivory`,
      width: 800,
      height: 1000,
      position: 0,
    },
  });
  const variants: Record<string, { id: string; sku: string }> = {};
  for (const s of size.values) {
    const sku = `JR-${tag}-${s.value}`;
    // No cost and no stock yet: both arrive with the purchase order.
    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        sku,
        priceMinor: 250000n,
        optionValues: { create: [{ optionValueId: color.values[0]!.id }, { optionValueId: s.id }] },
      },
    });
    variants[s.label] = { id: variant.id, sku };
  }
  return { title, slug, variants };
}

test.beforeAll(async () => {
  await db.$transaction((tx) => ensureReferenceData(tx), { timeout: 60_000 });
  // One default packaging profile (35 taka), as the demo seed installs.
  if (!(await db.packagingProfile.findFirst({ where: { isDefault: true } }))) {
    await db.packagingProfile.create({
      data: { name: 'E2E signature box', costMinor: 3500n, currency: 'BDT', isDefault: true },
    });
  }
});

test('stock in, order placed, verified, shipped, delivered, and the profit is on the order', async ({
  page,
  staffPage,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The long business flow is covered on desktop');
  const product = await makeProduct();
  const target = product.variants.M!;
  const supplier = await db.supplier.create({ data: { name: `Supplier ${tag}` } });
  const phone = uniquePhone();

  // --- 1. The owner raises a purchase order and receives it: stock and cost arrive together --------
  const owner = await staffPage({ role: 'owner' });
  await owner.goto('/admin/purchasing/new');
  await owner.getByLabel('Supplier').click();
  await owner.getByRole('option', { name: supplier.name }).click();
  await owner.getByLabel('Find a variant').fill(target.sku);
  await owner.getByRole('button', { name: 'Search variants' }).click();
  await owner.getByRole('button', { name: new RegExp(`^Add ${product.title}`) }).click();
  await owner.getByLabel('Quantity').fill('10');
  await owner.getByLabel('Unit cost').fill('1000');
  await owner.getByRole('button', { name: 'Create purchase order' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: /^PO-\d+/ })).toBeVisible();
  await owner.getByRole('button', { name: 'Place order' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
  await expect(owner.getByText(/placed/).first()).toBeVisible();
  await owner.getByRole('button', { name: 'Fill all outstanding' }).click();
  await owner.getByRole('button', { name: 'Record delivery' }).click();
  await expect(owner.getByText(/fully received/).first()).toBeVisible();
  const received = await db.productVariant.findUniqueOrThrow({ where: { id: target.id } });
  expect(received.avgCostMinor).toBe(100000n);
  expect(
    (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: target.id } })).onHand,
  ).toBe(10);
  await settle(owner);

  // --- 2. A customer places a cash on delivery order --------------------------------------------
  await page.goto(`/products/${product.slug}`);
  await page
    .getByRole('group', { name: 'Choose a size' })
    .getByRole('button', { name: /^M\b/ })
    .click();
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await expect(page.getByRole('dialog', { name: /Your bag/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/checkout');
  const form = page.getByRole('form', { name: 'Checkout' });
  await form.getByLabel(/Mobile number/).fill(phone);
  await form.getByLabel(/Full name/).fill('Ayaan Rahman');
  await form.getByLabel(/^Email/).fill('ayaan@example.com');
  await form.getByLabel(/^Division/).selectOption({ label: 'Dhaka' });
  await form.getByLabel(/^District/).selectOption({ label: 'Dhaka' });
  await form.getByLabel(/Thana or upazila/).selectOption({ label: 'Mirpur' });
  await form.getByLabel(/Area or neighbourhood/).fill('Section 10');
  await form.getByLabel(/House, road and landmark/).fill('House 12, Road 4, near the green mosque');
  await expect(page.locator('[data-testid="order-total"]:visible')).toHaveText('৳2,580');
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/track\/[A-Za-z0-9_-]{22}\?placed=1$/, { timeout: 60_000 });
  const orderNumber = (
    await page
      .getByText(/^Order AUR-\d+$/)
      .first()
      .innerText()
  ).replace('Order ', '');
  const trackUrl = page.url().replace('?placed=1', '');
  const placed = await db.order.findUniqueOrThrow({ where: { orderNumber } });
  expect(placed.status).toBe('placed');
  expect(placed.confirmedBy).toBeNull();

  // The order cannot be shipped or printed before a person verifies it.
  const unverified = await owner.request.get(
    `/admin/orders/${placed.id}/document?kind=packing_slip`,
  );
  expect(unverified.status()).toBe(409);

  // --- 3. A team member verifies it with the checklist --------------------------------------------
  const verifier = await staffPage({ role: 'order_verifier' });
  await verifier.goto(`/admin/orders/verification?order=${placed.id}`);
  await expect(
    verifier.getByRole('heading', { level: 1, name: 'Verification queue' }),
  ).toBeVisible();
  await expect(verifier.getByRole('heading', { level: 2, name: orderNumber })).toBeVisible();
  const confirm = verifier.getByRole('button', { name: 'Confirm order' });
  await expect(confirm).toBeDisabled();
  await expectNoAxeViolations(verifier);
  const checklist = verifier.getByRole('group', { name: /Verification checklist/ });
  const boxes = checklist.getByRole('checkbox');
  await expect(boxes).toHaveCount(5);
  for (let index = 0; index < 4; index += 1) await boxes.nth(index).click();
  // One point short: still cannot confirm.
  await expect(confirm).toBeDisabled();
  await boxes.nth(4).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(verifier.getByText(`Order ${orderNumber} confirmed`)).toBeVisible();
  const confirmed = await db.order.findUniqueOrThrow({ where: { id: placed.id } });
  expect(confirmed.status).toBe('confirmed');
  expect(confirmed.confirmedBy).not.toBeNull();
  const attempt = await db.orderVerificationAttempt.findFirstOrThrow({
    where: { orderId: placed.id },
  });
  expect(attempt.outcome).toBe('verified');
  expect(attempt.checklist).toMatchObject({
    genuine: true,
    items: true,
    address: true,
    payment: true,
    stock: true,
  });

  // The customer's page moves to "Verified".
  await page.goto(trackUrl);
  const steps = page.getByRole('list', { name: 'Order progress' }).getByRole('listitem');
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');

  // --- 4. The parcel goes to a manual courier ------------------------------------------------------
  await owner.goto(`/admin/orders/${placed.id}`);
  await expect(owner.getByRole('heading', { level: 1, name: orderNumber })).toBeVisible();
  await expect(owner.getByRole('link', { name: /Packing slip/ })).toBeVisible();
  const slip = await owner.request.get(`/admin/orders/${placed.id}/document?kind=packing_slip`);
  expect(slip.status()).toBe(200);
  expect(slip.headers()['content-type']).toBe('application/pdf');
  await owner.getByRole('button', { name: 'Book parcel' }).click();
  const booking = owner.getByRole('dialog');
  await booking.getByLabel(/Courier or rider name/).fill('Sundarban');
  await booking.getByLabel(/Tracking number/).fill(`SB-${tag}`);
  await booking.getByLabel(/Courier charge/).fill('90');
  await booking.getByRole('button', { name: 'Book parcel' }).click();
  await expect(owner.getByText('Parcel booked. The customer is told.')).toBeVisible();
  await settle(owner);
  await expect(owner.getByText(`SB-${tag}`).first()).toBeVisible();
  expect((await db.order.findUniqueOrThrow({ where: { id: placed.id } })).status).toBe('shipped');

  await page.goto(trackUrl);
  await expect(steps.nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText(`Tracking SB-${tag}`)).toBeVisible();

  // --- 5. Delivered: the cash is collected and the sale counts ------------------------------------
  await owner.getByRole('button', { name: 'Update parcel status' }).click();
  const status = owner.getByRole('dialog');
  await status.getByLabel('Status').selectOption('delivered');
  await status.getByLabel(/Courier collection fee/).fill('25');
  await status.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Delivered. The cash is recorded as collected.')).toBeVisible();
  await settle(owner);
  const delivered = await db.order.findUniqueOrThrow({ where: { id: placed.id } });
  expect(delivered).toMatchObject({
    status: 'delivered',
    paymentStatus: 'paid',
    paidMinor: 258000n,
  });

  // --- 6. The order page shows the profit ---------------------------------------------------------
  await owner.reload();
  const profit = owner.getByRole('region', { name: 'Cost and profit' });
  await expect(profit).toBeVisible();
  await expect(profit).toContainText('Delivered: the sale is counted.');
  const row = (label: string) =>
    profit.locator('div', { has: owner.locator(`dt:text-is("${label}")`) }).first();
  await expect(row('Gross sales')).toContainText('৳2,500');
  await expect(row('Cost of goods')).toContainText('৳1,000');
  await expect(row('Courier charge')).toContainText('৳90');
  await expect(row('Cash collection fees')).toContainText('৳25');
  await expect(row('Packaging')).toContainText('৳35');
  // 2,500 - 1,000 goods + 80 delivery charged - 90 courier - 25 collection - 35 packaging.
  await expect(row('Contribution margin')).toContainText('৳1,430');
  await expectNoAxeViolations(owner);

  // The customer sees Delivered, the parcel, and a way to ask for a return.
  await page.goto(trackUrl);
  await expect(steps.nth(3)).toHaveAttribute('aria-current', 'step');
  await expect(
    page.getByRole('heading', { name: 'Need to return or exchange something?' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  // Stock: 10 received, 1 sold.
  expect(
    (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: target.id } })).onHand,
  ).toBe(9);
});
