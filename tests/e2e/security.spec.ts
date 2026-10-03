import { expect, test } from '@playwright/test';

test.describe('security headers', () => {
  for (const path of ['/', '/admin/sign-in', '/api/auth/get-session']) {
    test(`${path} carries the baseline headers`, async ({ request }) => {
      const headers = (await request.get(path)).headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toContain('camera=()');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      const csp = headers['content-security-policy'] ?? '';
      expect(csp).toContain("frame-ancestors 'none'");
      if (path.startsWith('/api/')) {
        // data, not a document: nothing may load or frame it
        expect(csp).toContain("default-src 'none'");
      } else {
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("default-src 'self'");
      }
      expect(csp).not.toContain("'unsafe-eval'");
    });
  }

  test('the page still hydrates under the policy (no blocked scripts)', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      // The Vercel preview toolbar injects its own script; it is not part of the app.
      if (/content security policy/i.test(text) && !/vercel\.live/i.test(text))
        violations.push(text);
    });
    await page.goto('/admin/sign-in');
    await page.getByLabel('Email').fill('hydration@auren.test');
    await expect(page.getByLabel('Email')).toHaveValue('hydration@auren.test');
    // The error region only exists once React has hydrated and rendered the client form.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(violations).toEqual([]);
  });
});
