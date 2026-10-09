import type { Locator, Page } from '@playwright/test';
import { db } from '@/lib/db';
import { TEST_PASSWORD } from '../factories';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

// Signs in, renders console pages and writes to a real database.
test.describe.configure({ timeout: 180_000 });

/** Toasts carry a small close button that axe flags while they are on screen: wait them out. */
const settle = async (page: Page) =>
  expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });

/** The live stock cells of one variants-table row (cells follow the column order). */
const stockCells = (row: Locator) => ({
  onHand: row.getByRole('cell').nth(6),
  available: row.getByRole('cell').nth(7),
  cost: row.getByRole('cell').nth(8),
});

const unique = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function makeProductWithVariants(tag: string) {
  if (!(await db.location.findFirst({ where: { isDefault: true } }))) {
    await db.location.create({ data: { name: 'Main', isDefault: true } });
  }
  const product = await db.product.create({
    data: { slug: `e2e-cost-${tag.toLowerCase()}`, title: `Cost Test Shirt ${tag}` },
  });
  const first = await db.productVariant.create({
    data: { productId: product.id, sku: `CST-${tag}-1`, priceMinor: 450000n, position: 0 },
  });
  const second = await db.productVariant.create({
    data: { productId: product.id, sku: `CST-${tag}-2`, priceMinor: 450000n, position: 1 },
  });
  return { product, first, second };
}

test.describe('cost basis for variants without one', () => {
  test('adding stock asks for a unit cost, the product page shows it, and Set cost fixes the rest', async ({
    staffPage,
  }) => {
    const tag = unique();
    const { product, first, second } = await makeProductWithVariants(tag);
    const page = await staffPage({ role: 'owner' });

    // The inventory list flags the variants and counts them.
    await page.goto(`/admin/inventory?q=${first.sku}`);
    await expect(page.getByText(/cannot be sold: no cost/)).toBeVisible();
    await expect(page.getByText('No cost', { exact: true }).first()).toBeVisible();
    await expectNoAxeViolations(page);

    // Adding stock to a variant with no cost needs a unit cost.
    await page.getByRole('button', { name: /^Adjust stock for Cost Test Shirt/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Units to add or remove/).fill('5');
    await expect(dialog.getByLabel(/Unit cost/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog.getByText('Enter what one unit cost you.')).toBeVisible();
    await dialog.getByLabel(/Unit cost/).fill('1000');
    // Setting a cost this way needs the same fresh confirmation as Set cost.
    await dialog.getByLabel('Your password').fill(TEST_PASSWORD);
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog).toBeHidden();
    await settle(page);

    const costed = await db.productVariant.findUniqueOrThrow({ where: { id: first.id } });
    expect(costed.avgCostMinor).toBe(100000n);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { variantId: first.id } });
    expect(movement).toMatchObject({ quantity: 5, unitCostMinor: 100000n });

    // The stock change shows on the product edit page, reached by an in-app link (no stale rows).
    await page
      .getByRole('link', { name: `Cost Test Shirt ${tag}` })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${product.id}$`));
    const table = page.getByRole('table', { name: `Variants of Cost Test Shirt ${tag}` });
    const firstRow = table
      .getByRole('row')
      .filter({ has: page.locator(`input[value="${first.sku}"]`) });
    const secondRow = table
      .getByRole('row')
      .filter({ has: page.locator(`input[value="${second.sku}"]`) });
    await expect(stockCells(firstRow).onHand).toHaveText(/^5$/);
    await expect(stockCells(firstRow).available).toHaveText(/^5$/);
    await expect(stockCells(firstRow).cost).toContainText('1,000');
    await expect(stockCells(secondRow).onHand).toHaveText(/^0$/);
    await expect(stockCells(secondRow).cost).toHaveText('None');
    await expect(firstRow).not.toContainText('No cost: cannot be ordered');
    await expect(secondRow).toContainText('No cost: cannot be ordered');
    await expect(page.getByText(/set a cost in inventory first/)).toBeVisible();
    await expectNoAxeViolations(page);

    // Stock changed in inventory is visible here again after saving there.
    await page.goto(`/admin/inventory?q=${first.sku}`);
    await page.getByRole('button', { name: /^Adjust stock for Cost Test Shirt/ }).click();
    await dialog.getByLabel(/Units to add or remove/).fill('3');
    await dialog.getByRole('button', { name: 'Save adjustment' }).click();
    await expect(dialog).toBeHidden();
    await settle(page);
    await page
      .getByRole('link', { name: `Cost Test Shirt ${tag}` })
      .first()
      .click();
    await expect(stockCells(firstRow).onHand).toHaveText(/^8$/);
    await expect(stockCells(firstRow).available).toHaveText(/^8$/);
    await expect(stockCells(firstRow).cost).toContainText('1,000');

    // Set cost for every variant of the product, with a preview and a fresh password.
    await page.goto(`/admin/inventory?q=${second.sku}`);
    await page.getByRole('button', { name: /^Set cost for Cost Test Shirt/ }).click();
    await dialog.getByRole('button', { name: 'All variants of this product' }).click();
    await dialog.getByLabel(/Unit cost/).fill('900');
    await expect(dialog.getByText('Gets this cost')).toHaveCount(1);
    await expect(dialog.getByText('Keeps its cost')).toHaveCount(1);
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Set cost', exact: true }).click();
    await expect(dialog.getByText(/Confirm your password/).first()).toBeVisible();
    await dialog.getByLabel('Your password').fill(TEST_PASSWORD);
    await dialog.getByRole('button', { name: 'Set cost', exact: true }).click();
    await expect(dialog).toBeHidden();
    await settle(page);

    const other = await db.productVariant.findUniqueOrThrow({ where: { id: second.id } });
    expect(other.avgCostMinor).toBe(90000n);
    const untouched = await db.productVariant.findUniqueOrThrow({ where: { id: first.id } });
    expect(untouched.avgCostMinor).toBe(100000n);

    // The product page shows the new cost in the Cost cell, not only the database.
    await page.goto(`/admin/products/${product.id}`);
    await expect(stockCells(secondRow).cost).toContainText('900');
    await expect(stockCells(firstRow).cost).toContainText('1,000');
  });

  test('staff without inventory.adjust see the flag but no Set cost button', async ({
    staffPage,
  }) => {
    const tag = unique();
    const { first } = await makeProductWithVariants(tag);
    const page = await staffPage({ role: 'fulfillment' });
    await page.goto(`/admin/inventory?q=${first.sku}`);
    await expect(page.getByText('No cost', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Set cost for/ })).toHaveCount(0);
  });
});
