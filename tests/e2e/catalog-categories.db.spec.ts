import { db } from '@/lib/db';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

// These flows sign in, render several console pages and write to a real database.
test.describe.configure({ timeout: 120_000 });

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test.describe('categories admin', () => {
  test('creates a category, renames its slug and keeps the old address working', async ({
    staffPage,
    baseURL,
  }) => {
    const page = await staffPage({ role: 'owner' });
    const name = `Capes ${unique()}`;

    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('link', { name: 'New category' }).first().click();
    await expect(page.getByRole('heading', { name: 'New category' })).toBeVisible();
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Create category' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText(name)).toBeVisible();

    const created = await db.category.findFirstOrThrow({ where: { name } });
    await page.goto(`/admin/categories/${created.id}`);
    const newSlug = `${created.slug}-renamed`;
    await page.getByLabel('Slug').fill(newSlug);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Category saved').first()).toBeVisible();

    // The old address answers with a permanent redirect (301), resolved by the proxy.
    // The proxy keeps a short-lived snapshot of the redirects table (15 s), so allow for it.
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`${baseURL}/shop/${created.slug}`, {
            maxRedirects: 0,
          });
          return `${response.status()} ${new URL(response.headers().location ?? '', baseURL).pathname}`;
        },
        { timeout: 45_000, intervals: [2_000] },
      )
      .toBe(`301 /shop/${newSlug}`);

    const audit = await db.auditLog.findMany({
      where: { entityId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((row) => row.action)).toEqual(['category.create', 'category.update']);
  });

  test('refuses a duplicate slug with a readable message', async ({ staffPage }) => {
    const page = await staffPage({ role: 'owner' });
    const name = `Gilets ${unique()}`;
    await page.goto('/admin/categories/new');
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Create category' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    await page.goto('/admin/categories/new');
    await page.getByLabel('Name').fill(`${name} again`);
    await page
      .getByLabel('Slug')
      .fill((await db.category.findFirstOrThrow({ where: { name } })).slug);
    await page.getByRole('button', { name: 'Create category' }).click();
    await expect(page.getByText(/already uses this slug/i).first()).toBeVisible();
  });

  test('hides write controls from staff who can only read the catalogue', async ({ staffPage }) => {
    const page = await staffPage({ role: 'content_editor' });
    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New category' })).toHaveCount(0);
    expect((await page.goto('/admin/categories/new'))?.status()).toBeLessThan(500);
    await expect(page.getByRole('button', { name: 'Create category' })).toHaveCount(0);
  });

  test('keeps the console closed to staff without any catalogue permission', async ({
    staffPage,
  }) => {
    const page = await staffPage({ role: 'fulfillment' });
    await page.goto('/admin/categories');
    await expect(page.getByRole('heading', { name: /stepped out/i })).toBeVisible();
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });
});

test.describe('size charts admin', () => {
  test('creates a size chart with a grid and previews it', async ({ staffPage }) => {
    const page = await staffPage({ role: 'owner' });
    const name = `Shirts ${unique()}`;
    await page.goto('/admin/size-charts/new');
    await expectNoAxeViolations(page);
    await page.getByLabel('Name').first().fill(name);
    await page.getByLabel('Measurement 1 name').fill('Chest');
    await page.getByLabel('Size, row 1').fill('S');
    await page.getByLabel('Row 1, Chest').fill('96');
    await expect(page.getByRole('region', { name: 'Size chart preview' })).toContainText('96');
    // Submit from the keyboard: on a phone the sticky action bar overlaps the page content, which
    // makes pointer hit-testing unreliable in the automated browser.
    await page.getByRole('button', { name: 'Create size chart' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/size-charts$/, { timeout: 60_000 });
    await expect(page.getByRole('link', { name }).first()).toBeVisible();

    const chart = await db.sizeChart.findFirstOrThrow({ where: { name } });
    const table = chart.table as {
      columns: string[];
      rows: Array<{ size: string; values: string[] }>;
    };
    expect(table.columns[0]).toBe('Chest');
    expect(table.rows[0]).toEqual({ size: 'S', values: ['96', ''] });
  });
});
