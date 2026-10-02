import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

const SECTIONS = [
  'colour',
  'typography',
  'shape',
  'motion',
  'buttons',
  'forms',
  'overlays',
  'feedback',
  'commerce',
  'storefront',
  'admin',
];

async function open(page: Page) {
  await page.goto('/admin/style-guide');
  await expect(page.getByRole('heading', { name: 'Style guide', level: 1 })).toBeVisible();
}

test.describe('style guide', () => {
  test('renders every section with one h1 and no horizontal scrolling', async ({ page }) => {
    await open(page);
    for (const id of SECTIONS) {
      await expect(page.locator(`[data-section="${id}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('passes the accessibility scan in light and dark', async ({ page }) => {
    await open(page);
    await expectNoAxeViolations(page);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
    await expectNoAxeViolations(page);
  });

  test('prints tokens that match the brand', async ({ page }) => {
    await open(page);
    const colour = page.locator('[data-section="colour"]');
    await expect(colour.getByText('#A8875A')).toBeVisible();
    await expect(colour.getByText('#0F0F0F')).toBeVisible();
    await expect(page.locator('[data-section="commerce"]').getByText('৳999').first()).toBeVisible();
  });

  test('uses Cormorant for headings and Manrope for body', async ({ page }) => {
    await open(page);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const serif = document.querySelector('[data-section="typography"] .type-h1');
      const sans = document.querySelector('[data-section="typography"] .type-body');
      return {
        serif: serif ? getComputedStyle(serif).fontFamily : '',
        sans: sans ? getComputedStyle(sans).fontFamily : '',
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
      };
    });
    expect(fonts.serif).toMatch(/cormorant/i);
    expect(fonts.sans).toMatch(/manrope/i);
    expect(fonts.loaded.join(' ')).toMatch(/cormorant/i);
    expect(fonts.loaded.join(' ')).toMatch(/manrope/i);
  });

  test('button focus ring is gold, 2px, offset 2px', async ({ page }) => {
    await open(page);
    const button = page
      .locator('[data-section="buttons"]')
      .getByRole('button', { name: 'Checkout' })
      .first();
    await button.focus();
    const ring = await button.evaluate((node) => {
      const style = getComputedStyle(node);
      return { width: style.outlineWidth, offset: style.outlineOffset, colour: style.outlineColor };
    });
    expect(ring.width).toBe('2px');
    expect(ring.offset).toBe('2px');
    expect(ring.colour).toBe('rgb(168, 135, 90)');
  });

  test('disabled and loading buttons cannot be activated', async ({ page }) => {
    await open(page);
    const buttons = page.locator('[data-section="buttons"]');
    await expect(buttons.getByRole('button', { name: 'Checkout' }).nth(2)).toBeDisabled();
    await expect(buttons.getByRole('button', { name: 'Placing order' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  test('form errors are announced and tied to their field', async ({ page }) => {
    await open(page);
    const field = page.getByLabel('Mobile number');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!.split(' ')[0]}`)).toContainText(
      'Enter a mobile number',
    );
  });

  test('select, checkbox and radio work from the keyboard', async ({ page }) => {
    await open(page);
    const select = page.getByRole('combobox', { name: 'Division' });
    await select.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'Sylhet' }).click();
    await expect(select).toContainText('Sylhet');

    const checkbox = page.getByRole('checkbox', { name: 'Gift wrap' });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();

    const radio = page.getByRole('radio', { name: 'bKash' });
    await radio.click();
    await expect(radio).toBeChecked();
  });
});

test.describe('style guide overlays', () => {
  test('dialog opens, traps focus, closes with Escape and returns focus', async ({ page }) => {
    await open(page);
    const trigger = page.getByRole('button', { name: 'Open dialog' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Remove this piece from your bag?' });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('drawers slide in from the right and the bottom', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Open drawer (right)' }).click();
    const right = page.getByRole('dialog', { name: 'Your bag' });
    await expect(right).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(right).toBeHidden();

    await page.getByRole('button', { name: 'Open drawer (bottom)' }).click();
    await expect(page.getByRole('dialog', { name: 'Size guide' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Size guide' })).toBeHidden();
  });

  test('popover and tooltip appear and dismiss', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Open popover' }).click();
    await expect(page.getByText('Dhaka: 1 to 2 working days.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Dhaka: 1 to 2 working days.')).toBeHidden();

    await page.getByRole('button', { name: 'About the fit' }).focus();
    await expect(page.getByRole('tooltip').getByText('Fits true to size')).toBeVisible();
  });

  test('accordion and tabs respond to the keyboard', async ({ page }) => {
    await open(page);
    const fabric = page.getByRole('button', { name: 'Fabric and care' });
    await fabric.focus();
    await page.keyboard.press('Enter');
    await expect(fabric).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('100% Egyptian cotton. Machine wash cold.')).toBeVisible();

    const description = page.getByRole('tab', { name: 'Description' });
    await description.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Reviews' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Reviews appear here.')).toBeVisible();
  });

  test('toasts are announced and the undo toast offers an action', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Undo toast' }).click();
    const toast = page.getByText('Removed from your bag');
    await expect(toast).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Restored')).toBeVisible();
  });
});

test.describe('style guide data table', () => {
  const table = (page: Page) => page.getByRole('table', { name: 'Sample orders' });

  test('sorts by a column and marks it for assistive tech', async ({ page }) => {
    await open(page);
    const firstCell = () => table(page).locator('tbody tr').first().locator('td').nth(1);
    await expect(firstCell()).toHaveText('AU-10482');
    await table(page)
      .getByRole('button', { name: /^Order/ })
      .click();
    await expect(table(page).getByRole('columnheader', { name: /Order/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(firstCell()).toHaveText('AU-10479');
    await table(page)
      .getByRole('button', { name: /^Order/ })
      .click();
    await expect(firstCell()).toHaveText('AU-10482');
  });

  test('selecting rows reveals bulk actions that never confirm orders', async ({ page }) => {
    await open(page);
    await page.getByRole('checkbox', { name: 'Select row AU-10482' }).click();
    const bulk = page.getByRole('region', { name: 'Bulk actions' });
    await expect(bulk).toContainText('1 selected');
    await expect(bulk.getByRole('button', { name: 'Print 1 packing slip' })).toBeVisible();
    await expect(bulk.getByRole('button', { name: /confirm/i })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Select all rows' }).first().click();
    await expect(bulk).toContainText('4 selected');
    await bulk.getByRole('button', { name: 'Clear selection' }).click();
    await expect(bulk).toBeHidden();
  });

  test('exports a spreadsheet-safe CSV', async ({ page }) => {
    await open(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('sample-orders.csv');
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf8');
    expect(csv).toContain('Order,Customer,Total,Status');
    expect(csv).toContain('AU-10482,Ayaan Rahman');
  });

  test('shows loading, empty and error states', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('region', { name: 'Loading orders' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(page.getByText('Nothing here yet')).toBeVisible();
    await expect(page.getByText('The list could not be loaded.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
  });
});
