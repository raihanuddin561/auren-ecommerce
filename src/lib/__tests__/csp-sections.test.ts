import { NextRequest } from 'next/server';
import { match } from 'next/dist/compiled/path-to-regexp';
import { describe, expect, it, vi } from 'vitest';
import { proxy } from '../../proxy';

// The proxy asks the catalogue for slug redirects; these tests are about headers only.
vi.mock('@/modules/catalog/queries', () => ({ resolveRedirect: async () => null }));
import {
  API_CSP,
  NONCE_SECTIONS,
  PERMISSIONS_POLICY,
  headerRules,
  isNonceSection,
  newNonce,
} from '../security/headers';

const options = { isDev: false, isProduction: true, appUrl: 'https://auren.com.bd' };
const rules = headerRules(options);

/** Header values a path receives, the way Next.js applies matching rules. */
function headersFor(pathname: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const rule of rules) {
    if (!match(rule.source)(pathname)) continue;
    for (const header of rule.headers) {
      result.set(header.key, [...(result.get(header.key) ?? []), header.value]);
    }
  }
  return result;
}

const request = (path: string, cookie = 'auren.session_token=abc.def') =>
  new NextRequest(`http://localhost:3000${path}`, { headers: { cookie } });

describe('which paths are dynamic sections', () => {
  it.each(['/admin', '/admin/orders', '/checkout', '/checkout/payment', '/account', '/api/auth/x'])(
    '%s gets a nonce',
    (path) => expect(isNonceSection(path)).toBe(true),
  );
  it.each(['/%61dmin', '/ADMIN/orders', '//admin', '/Api/health', '/admin//x'])(
    '%s is still /admin or /api',
    (path) => expect(isNonceSection(path)).toBe(true),
  );
  it('does not throw on malformed escapes', async () => {
    expect(isNonceSection('/%E0%A4%A')).toBe(false);
    expect(isNonceSection('/admin/%E0%A4%A')).toBe(true);
  });
  it.each(['/', '/products/oxford', '/administration', '/accounts', '/apiary', '/checkouts'])(
    '%s does not',
    (path) => expect(isNonceSection(path)).toBe(false),
  );
});

describe('header rules (every path gets exactly one value per header)', () => {
  const paths = [
    '/',
    '/products/oxford-shirt',
    '/administration',
    '/admin',
    '/admin/orders',
    '/checkout',
    '/account/orders',
    '/api/health',
    '/reset-password',
    '/reset-password/abc',
    '/verify-email',
    '/track/ORD-1',
    '/tracking-info',
  ];

  it.each(paths)('%s', (path) => {
    for (const [key, values] of headersFor(path)) {
      expect(values, `${key} on ${path}`).toHaveLength(1);
    }
  });

  it('puts the static CSP on the storefront only', async () => {
    const storefront = headersFor('/products/oxford-shirt').get('Content-Security-Policy')?.[0];
    expect(storefront).toContain("script-src 'self' 'unsafe-inline'");
    for (const path of ['/admin', '/admin/orders', '/checkout', '/account', '/api/health']) {
      expect(headersFor(path).has('Content-Security-Policy'), path).toBe(false);
    }
    expect(headersFor('/administration').has('Content-Security-Policy')).toBe(true);
  });

  it('adds Cross-Origin-Resource-Policy to dynamic sections only (email images must stay loadable)', async () => {
    for (const path of ['/admin', '/checkout/pay', '/account', '/api/auth/session']) {
      expect(headersFor(path).get('Cross-Origin-Resource-Policy')).toEqual(['same-origin']);
    }
    expect(headersFor('/').has('Cross-Origin-Resource-Policy')).toBe(false);
    expect(headersFor('/seed/shirt.svg').has('Cross-Origin-Resource-Policy')).toBe(false);
  });

  it('sends no Referer from pages whose URL carries a token', async () => {
    for (const path of ['/reset-password', '/reset-password/tok', '/verify-email', '/track/abc']) {
      expect(headersFor(path).get('Referrer-Policy')).toEqual(['no-referrer']);
    }
    for (const path of ['/', '/products/x', '/tracking-info']) {
      expect(headersFor(path).get('Referrer-Policy')).toEqual(['strict-origin-when-cross-origin']);
    }
  });

  it('keeps the baseline everywhere, including HSTS', async () => {
    for (const path of paths) {
      const headers = headersFor(path);
      expect(headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(headers.get('X-Content-Type-Options')).toEqual(['nosniff']);
      expect(headers.get('X-Frame-Options')).toEqual(['DENY']);
      expect(headers.get('Cross-Origin-Opener-Policy')).toEqual(['same-origin']);
      expect(headers.get('Permissions-Policy')).toEqual([PERMISSIONS_POLICY]);
    }
  });

  it('denies powerful browser features by default', async () => {
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'usb',
      'serial',
      'bluetooth',
      'hid',
    ]) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
    expect(PERMISSIONS_POLICY).toContain('payment=(self)');
    expect(PERMISSIONS_POLICY).toContain('browsing-topics=()');
  });
});

describe('per-request nonce from the proxy', () => {
  const policyOf = (response: Response) => response.headers.get('content-security-policy') ?? '';
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

  it('issues a fresh 128-bit nonce for every admin request and no unsafe-inline for scripts', async () => {
    const a = policyOf(await proxy(request('/admin/orders')));
    const b = policyOf(await proxy(request('/admin/orders')));
    expect(nonceOf(a)).toBeTruthy();
    expect(nonceOf(a)).not.toBe(nonceOf(b));
    expect(atob(nonceOf(a)!)).toHaveLength(16);
    const script = a.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain('unsafe-inline');
    expect(a).toContain("frame-ancestors 'none'");
    expect(a).toContain("object-src 'none'");
  });

  it('hands the same nonce to the page through request headers', async () => {
    const response = await proxy(request('/admin/orders'));
    const forwarded = response.headers.get('x-middleware-request-x-nonce');
    expect(forwarded).toBe(nonceOf(policyOf(response)));
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(
      policyOf(response),
    );
  });

  it.each(['/checkout', '/checkout/payment', '/account', '/account/orders'])(
    'covers %s as well',
    async (path) => {
      expect(nonceOf(policyOf(await proxy(request(path))))).toBeTruthy();
    },
  );

  it('locks API responses down completely instead of issuing a nonce', async () => {
    expect(policyOf(await proxy(request('/api/health')))).toBe(API_CSP);
    expect(policyOf(await proxy(request('/api/webhooks/stripe')))).toBe(API_CSP);
  });

  it('forbids inline handlers explicitly and never lets a nonce response be cached', async () => {
    const response = await proxy(request('/admin/orders'));
    expect(policyOf(response)).toContain("script-src-attr 'none'");
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('Cookie');
    expect((await proxy(request('/api/health'))).headers.get('cache-control')).toBeNull();
  });

  it('gives the maintenance page a policy whatever section was requested', async () => {
    process.env.MAINTENANCE_MODE = '1';
    try {
      const checkout = await proxy(request('/checkout'));
      expect(checkout.status).toBe(503);
      expect(policyOf(checkout)).toContain("script-src 'self' 'unsafe-inline'");
      expect(policyOf(await proxy(request('/api/orders')))).toBe(API_CSP);
    } finally {
      delete process.env.MAINTENANCE_MODE;
    }
  });

  it('leaves the prerendered storefront to the static header', async () => {
    expect(
      (await proxy(request('/products/oxford-shirt'))).headers.get('content-security-policy'),
    ).toBeNull();
    expect((await proxy(request('/'))).headers.get('content-security-policy')).toBeNull();
  });

  it('produces unique base64 nonces', async () => {
    const seen = new Set(Array.from({ length: 200 }, () => newNonce()));
    expect(seen.size).toBe(200);
    for (const nonce of seen) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it('keeps the section list in step with the matcher', async () => {
    expect([...NONCE_SECTIONS]).toEqual(['/admin', '/checkout', '/account', '/api']);
  });
});
