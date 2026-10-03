import { expect, test } from '@playwright/test';

/**
 * The console is rendered per request with a nonce-based Content-Security-Policy. This proves the
 * policy is enforced by a real browser and that the page still hydrates under it.
 */
test.describe('admin Content-Security-Policy', () => {
  test('sends a fresh nonce policy without unsafe-inline for scripts', async ({ page }) => {
    const first = await page.goto('/admin');
    const second = await page.goto('/admin');
    const a = (await first!.allHeaders())['content-security-policy'] ?? '';
    const b = (await second!.allHeaders())['content-security-policy'] ?? '';
    const nonce = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce(a)).toBeTruthy();
    expect(nonce(a)).not.toBe(nonce(b));
    const script = a.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain('unsafe-inline');
    const headers = await second!.allHeaders();
    expect(headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('every script carries the nonce, nothing is blocked, and the page hydrates', async ({
    page,
  }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __csp: string[] }).__csp ??= [];
        (window as unknown as { __csp: string[] }).__csp.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto('/admin');
    const csp = (await response!.allHeaders())['content-security-policy'] ?? '';
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];

    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll('script')].map((s) => ({
        // the nonce attribute is hidden from the DOM property after parsing, but kept as data
        nonce: s.nonce || s.getAttribute('nonce') || '',
        src: s.src,
        inline: !s.src,
      })),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script.nonce, JSON.stringify(script)).toBe(nonce);

    // Hydration: an interactive island works only if its scripts ran under the policy.
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    violations.push(
      ...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp)) ?? []),
    );
    expect(violations.filter((v) => !v.includes('eval'))).toEqual([]);
    expect(consoleErrors.filter((m) => /content security policy|refused to/i.test(m))).toEqual([]);
  });

  test('refuses injected inline handlers (the policy really blocks them)', async ({ page }) => {
    await page.goto('/admin');
    const outcome = await page.evaluate(async () => {
      const blocked: string[] = [];
      document.addEventListener('securitypolicyviolation', (event) =>
        blocked.push(event.violatedDirective),
      );
      // The markup an XSS bug would inject: an inline event handler. (A script element created by
      // trusted code is allowed by strict-dynamic, so a handler is the faithful probe.)
      const host = document.createElement('div');
      host.innerHTML =
        '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="window.__injected = true">';
      document.body.appendChild(host);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const image = host.querySelector('img')!;
      return {
        ran: Boolean((window as unknown as { __injected?: boolean }).__injected),
        imageLoaded: image.complete && image.naturalWidth === 1,
        blocked,
      };
    });
    // The image itself loaded, so its onload handler would have run had the policy allowed it.
    expect(outcome.imageLoaded).toBe(true);
    expect(outcome.ran).toBe(false);
  });
});
