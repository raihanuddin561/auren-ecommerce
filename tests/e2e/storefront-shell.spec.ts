import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

test.describe('storefront shell', () => {
  test('shows the announcement bar, header, footer and concierge button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Announcements' })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Speak to our concierge' })).toHaveAttribute(
      'href',
      '/contact',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modern, refined menswear');
  });

  test('offers a skip link as the first tab stop', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('lets visitors pause the announcements', async ({ page }) => {
    await page.goto('/');
    const pause = page.getByRole('button', { name: 'Pause announcements' });
    await pause.click();
    await expect(page.getByRole('button', { name: 'Resume announcements' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('keeps the header transparent over the hero and turns it solid after scrolling', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header).toHaveAttribute('data-transparent', 'true');
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect(header).toHaveAttribute('data-transparent', 'false');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute('data-transparent', 'true');
  });

  test('the home page passes the accessibility scan', async ({ page }) => {
    await page.goto('/');
    await expectNoAxeViolations(page);
  });

  test('the newsletter form validates the address and is honest while sign-ups are closed', async ({
    page,
  }) => {
    await page.goto('/');
    const email = page.getByLabel('Email address');
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid email' })).toBeVisible();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await email.fill('ayaan@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'not open just yet' })).toBeVisible();
  });
});

test.describe('desktop navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop navigation is hidden on small screens');
  });

  test('opens the mega menu with the mouse and closes it with Escape, returning focus', async ({
    page,
  }) => {
    await page.goto('/');
    const shop = page.getByRole('button', { name: 'Shop' });
    await expect(shop).toHaveAttribute('aria-expanded', 'false');
    await shop.hover();
    await expect(shop).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Shirts' }),
    ).toBeVisible();
    await expect(page.getByRole('banner')).toHaveAttribute('data-transparent', 'false');
    await page.keyboard.press('Escape');
    await expect(shop).toHaveAttribute('aria-expanded', 'false');
    await expect(shop).toBeFocused();
  });

  test('works from the keyboard alone', async ({ page }) => {
    await page.goto('/');
    const shop = page.getByRole('button', { name: 'Shop' });
    await shop.focus();
    await page.keyboard.press('Enter');
    await expect(shop).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Shirts' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(shop).toHaveAttribute('aria-expanded', 'false');
  });

  test('the open mega menu passes the accessibility scan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Shirts' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('mobile navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'the full-screen menu is for small screens');
  });

  test('opens a full-screen menu, traps focus and returns it on close', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open menu' });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await page.getByRole('button', { name: 'Shop' }).click();
    await expect(page.getByRole('link', { name: 'Shirts' })).toBeVisible();
    for (let i = 0; i < 25; i += 1) await page.keyboard.press('Tab');
    expect(await menu.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the open menu passes the accessibility scan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('has no horizontal scrolling at 375px', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('keeps content visible and turns transitions into instant changes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const cta = page.getByRole('link', { name: 'Explore the collection' });
    const seconds = await cta.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).transitionDuration),
    );
    expect(seconds).toBeLessThan(0.001);
  });
});
