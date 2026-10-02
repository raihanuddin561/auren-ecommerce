import { expect, test, type Page } from '@playwright/test';

/**
 * Visual snapshots of the style guide. Baselines are per platform, so these run only with
 * E2E_VISUAL=1 (`pnpm test:e2e:visual`); update them with `--update-snapshots` after a deliberate
 * design change and review the diff.
 */

const SECTIONS = [
  'colour',
  'typography',
  'shape',
  'motion',
  'buttons',
  'forms',
  'feedback',
  'commerce',
  'storefront',
  'admin',
];

async function prepare(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('auren-admin-theme', value);
    } catch {
      // ignore
    }
  }, theme);
  await page.goto('/admin/style-guide');
  await expect(page.getByRole('heading', { name: 'Style guide', level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The sticky top bar would overlap element screenshots, and the reveal specimen is animated.
  await page.addStyleTag({
    content:
      'header.sticky{position:static!important} .reveal{opacity:1!important;transform:none!important}',
  });
}

test.describe('style guide visual snapshots', () => {
  test.describe('light', () => {
    for (const id of SECTIONS) {
      test(`${id}`, async ({ page }) => {
        await prepare(page, 'light');
        const section = page.locator(`[data-section="${id}"]`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`light-${id}.png`);
      });
    }
  });

  test.describe('dark admin theme', () => {
    for (const id of ['buttons', 'forms', 'feedback', 'admin']) {
      test(`${id}`, async ({ page }) => {
        await prepare(page, 'dark');
        const section = page.locator(`[data-section="${id}"]`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`dark-${id}.png`);
      });
    }
  });
});
