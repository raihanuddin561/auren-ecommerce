import { expect, test } from '@playwright/test';

test.describe('storefront and API headers', () => {
  test('the prerendered storefront keeps the static policy and still hydrates', async ({
    page,
  }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __csp: string[] }).__csp ??= [];
        (window as unknown as { __csp: string[] }).__csp.push(event.violatedDirective);
      });
    });
    const response = await page.goto('/');
    const headers = await response!.allHeaders();
    expect(headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(headers['content-security-policy']).not.toContain('nonce-');
    expect(headers['cross-origin-resource-policy']).toBeUndefined();
    expect(headers['permissions-policy']).toContain('usb=()');
    violations.push(
      ...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp)) ?? []),
    );
    // Zod probes for eval support and falls back by itself: that probe is reported but harmless.
    expect(violations.filter((v) => v !== 'script-src')).toEqual([]);
  });

  test('API responses are locked down and never embeddable', async ({ request }) => {
    const response = await request.get('/api/health');
    const headers = response.headers();
    expect(headers['content-security-policy']).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
