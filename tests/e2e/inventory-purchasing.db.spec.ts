import type { Page } from '@playwright/test';
import { db } from '@/lib/db';
import { TEST_PASSWORD } from '../factories';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

// Signs in, renders several console pages and writes to a real database.
test.describe.configure({ timeout: 180_000 });

/** Toasts carry a small close button that axe flags while they are on screen: wait them out. */
const settle = async (page: Page) =>
  expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });

const unique = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function ensureLocation() {
  const existing = await db.location.findFirst({ where: { isDefault: true } });
  if (!existing) await db.location.create({ data: { name: 'Main', isDefault: true } });
}

async function makeProduct(tag: string) {
  await ensureLocation();
  const product = await db.product.create({
    data: { slug: `e2e-stock-${tag.toLowerCase()}`, title: `Stock Test Shirt ${tag}` },
  });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku: `E2E-${tag}`, priceMinor: 450000n },
  });
  return { product, variant };
}

test.describe('suppliers, purchase orders and stock', () => {
  test('raises a purchase order, receives it, and adjusts the stock', async ({
    staffPage,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'The long flow is covered on desktop');
    const tag = unique();
    const { variant } = await makeProduct(tag);
    const page = await staffPage({ role: 'owner' });

    // Supplier
    await page.goto('/admin/suppliers/new');
    await page.getByLabel('Name').fill(`Supplier ${tag}`);
    await page.getByRole('button', { name: 'Create supplier' }).click();
    await expect(page).toHaveURL(/\/admin\/suppliers$/);
    await expect(page.getByRole('link', { name: `Supplier ${tag}` })).toBeVisible();

    // Purchase order
    await page.goto('/admin/purchasing/new');
    await expectNoAxeViolations(page);
    await page.getByLabel('Supplier').click();
    await page.getByRole('option', { name: `Supplier ${tag}` }).click();
    await page.getByLabel('Find a variant').fill(variant.sku);
    await page.getByRole('button', { name: 'Search variants' }).click();
    await page.getByRole('button', { name: /^Add Stock Test Shirt/ }).click();
    await page.getByLabel('Quantity').fill('10');
    await page.getByLabel('Unit cost').fill('1000');
    await page.getByRole('button', { name: 'Create purchase order' }).click();
    await expect(page).toHaveURL(/\/admin\/purchasing\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: /^PO-\d+/ })).toBeVisible();
    const poId = page.url().split('/').pop()!;

    // Landed cost, then place the order
    await page.getByLabel('Amount').fill('500');
    await page.getByRole('button', { name: 'Add cost' }).click();
    await expect(page.getByText('Cost added').first()).toBeVisible();
    await expect(page.getByRole('list').filter({ hasText: 'Freight' })).toBeVisible();
    await page.getByRole('button', { name: 'Place order' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByText(/placed/).first()).toBeVisible();

    // The PDF is a real download
    const pdf = await page.request.get(`/admin/purchasing/${poId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    // Partial then full receipt
    await page.getByLabel('Received now').fill('4');
    await page.getByRole('button', { name: 'Record delivery' }).click();
    await expect(page.getByText('Goods received').first()).toBeVisible();
    await expect(page.getByText('6 to come')).toBeVisible();
    await page.getByRole('button', { name: 'Fill all outstanding' }).click();
    await page.getByRole('button', { name: 'Record delivery' }).click();
    await expect(page.getByText(/fully received/).first()).toBeVisible();
    await settle(page);
    await expectNoAxeViolations(page);

    const level = await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(level.onHand).toBe(10);
    const costed = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    // 10 x 1,000.00 + 500.00 landed over 10 units
    expect(costed.avgCostMinor).toBe(105000n);

    // Inventory shows it and a count correction goes through with an audit row
    await page.goto(`/admin/inventory?q=${variant.sku}`);
    await expectNoAxeViolations(page);
    await expect(page.getByRole('row', { name: /Stock Test Shirt/ })).toContainText('10');
    await page.getByRole('button', { name: /^Adjust stock for Stock Test Shirt/ }).click();
    const dialog = page.getByRole('dialog');
    // Adding stock needs no step-up.
    await dialog.getByLabel(/Units to add or remove/).fill('2');
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.id } })).onHand,
      )
      .toBe(12);

    // Removing stock asks for the password again (a fresh step-up), then goes through.
    await page.getByRole('button', { name: /^Adjust stock for Stock Test Shirt/ }).click();
    await dialog.getByLabel(/Units to add or remove/).fill('-1');
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog.getByText(/Confirm your password/)).toBeVisible();
    await dialog.getByLabel('Your password').fill(TEST_PASSWORD);
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.id } })).onHand,
      )
      .toBe(11);
    expect(
      await db.auditLog.count({ where: { action: 'stock.adjust', entityId: variant.id } }),
    ).toBe(2);

    await page.goto(`/admin/inventory/movements?variant=${variant.id}`);
    await expectNoAxeViolations(page);
    await expect(page.getByRole('cell', { name: 'Receipt' }).first()).toBeVisible();
  });

  test('inventory and purchasing screens answer 404 to staff without the permission', async ({
    staffPage,
  }) => {
    const page = await staffPage({ role: 'content_editor' });
    for (const path of ['/admin/inventory', '/admin/purchasing', '/admin/suppliers']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: /stepped out/ })).toBeVisible();
    }
  });
});
