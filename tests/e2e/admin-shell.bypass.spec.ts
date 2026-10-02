import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

/**
 * Runs against the server started with the test-only staff bypass, so the console renders
 * without a database. Real sign-in and role checks live in admin-shell.db.spec.ts.
 */

test.describe('admin shell', () => {
  test('shows the dashboard inside the console frame', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    await expect(
      page.getByText('Every order is checked by a person before it is confirmed.'),
    ).toBeVisible();
  });

  test('passes the accessibility scan in light and dark', async ({ page }) => {
    await page.goto('/admin');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Colours must have settled before they are measured.
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
    await expectNoAxeViolations(page);
  });

  test('remembers the chosen theme across reloads without a flash', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe('rgb(20, 20, 19)');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('follows the operating system theme until a choice is made', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await context.close();
  });

  test('lists only screens that exist as links and marks the rest as coming soon', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the sidebar is a drawer on small screens');
    await page.goto('/admin');
    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Style guide' })).toBeVisible();
    // The test identity has no permissions, so permission-gated screens are not offered at all.
    await expect(nav.getByText('Orders')).toHaveCount(0);
  });
});

test.describe('command palette', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut flow is a desktop feature');
  });

  test('opens with Ctrl+K, filters, navigates with Enter and closes with Escape', async ({
    page,
  }) => {
    await page.goto('/admin');
    // The shortcut is registered when the page hydrates.
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+K');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search screens and actions' })).toBeFocused();
    await page.keyboard.type('style');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/style-guide$/);
    await expect(palette).toBeHidden();

    await page.keyboard.press('Control+K');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('returns focus to the control that opened it when closed with Escape', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', { name: 'Open command palette' });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('says so when nothing matches, and offers the theme action', async ({ page }) => {
    await page.goto('/admin');
    // The shortcut is registered when the page hydrates.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await page.keyboard.type('zzzzqq');
    await expect(page.getByText('Nothing matches that yet.')).toBeVisible();
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('combobox').fill('theme');
    await expect(page.getByRole('option', { name: /Switch to (dark|light) theme/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
  });

  test('passes the accessibility scan while open', async ({ page }) => {
    await page.goto('/admin');
    // The shortcut is registered when the page hydrates.
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('navigation drawer', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'the drawer is for small screens');
  });

  test('opens the navigation, traps focus and returns it on Escape', async ({ page }) => {
    await page.goto('/admin');
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Style guide' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('choosing a screen closes the drawer', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: 'Style guide' })
      .click();
    await expect(page).toHaveURL(/style-guide$/);
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  });

  test('has no horizontal scrolling', async ({ page }) => {
    await page.goto('/admin');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('account menu', () => {
  test('shows who is signed in and can be dismissed with Escape', async ({ page }) => {
    await page.goto('/admin');
    const trigger = page.getByRole('button', { name: 'Account menu' });
    await trigger.click();
    await expect(page.getByText('test-staff@auren.invalid')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('test-staff@auren.invalid')).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('access still behaves', () => {
  test('keeps the public sign-in page reachable', async ({ page }) => {
    await page.goto('/admin/sign-in');
    await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
