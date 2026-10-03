import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config, isUnderMaintenance, proxy } from '../proxy';

const lookup = vi.hoisted(() => ({ resolveRedirect: vi.fn() }));
vi.mock('@/modules/catalog/queries', () => ({ resolveRedirect: lookup.resolveRedirect }));

beforeEach(() => {
  lookup.resolveRedirect.mockReset();
  lookup.resolveRedirect.mockResolvedValue(null);
});

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe('admin gate in the proxy', () => {
  it('redirects anonymous visitors to staff sign-in and remembers where they were going', async () => {
    const response = await proxy(request('/admin/orders?status=placed'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/admin/sign-in');
    expect(location.searchParams.get('next')).toBe('/admin/orders?status=placed');
  });

  it('protects the admin root and nested routes', async () => {
    for (const path of ['/admin', '/admin/', '/admin/finance/pnl', '/admin/security']) {
      expect((await proxy(request(path))).status).toBe(307);
    }
  });

  it('lets the sign-in page through without a session', async () => {
    const response = await proxy(request('/admin/sign-in'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('passes requests that carry a session cookie to the layout for the real check', async () => {
    const response = await proxy(request('/admin/orders', 'auren.session_token=abc.def'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not touch storefront routes', async () => {
    expect((await proxy(request('/products/oxford-shirt'))).headers.get('location')).toBeNull();
  });
});

describe('maintenance mode', () => {
  it('is off unless MAINTENANCE_MODE is exactly 1', async () => {
    for (const value of [undefined, '', '0', 'true', 'on']) {
      expect(isUnderMaintenance('/', value), String(value)).toBe(false);
    }
    expect(isUnderMaintenance('/', '1')).toBe(true);
  });

  it('covers storefront pages but never the console, the API or the maintenance page itself', async () => {
    expect(isUnderMaintenance('/shop/shirts', '1')).toBe(true);
    expect(isUnderMaintenance('/checkout', '1')).toBe(true);
    expect(isUnderMaintenance('/maintenance', '1')).toBe(false);
    expect(isUnderMaintenance('/admin', '1')).toBe(false);
    expect(isUnderMaintenance('/admin/sign-in', '1')).toBe(false);
    expect(isUnderMaintenance('/api/webhooks/sslcommerz', '1')).toBe(false);
    expect(isUnderMaintenance('/api/inngest', '1')).toBe(false);
    expect(isUnderMaintenance('/api/auth/sign-in/email', '1')).toBe(false);
    // Any other API route (for example one that creates orders) is paused with the storefront.
    expect(isUnderMaintenance('/api/orders', '1')).toBe(true);
    expect(isUnderMaintenance('/api/health', '1')).toBe(false);
    expect(isUnderMaintenance('/administrator', '1')).toBe(true);
  });

  it('keeps the security contact reachable during maintenance', async () => {
    expect(isUnderMaintenance('/.well-known/security.txt', '1')).toBe(false);
    expect(isUnderMaintenance('/.well-known-x', '1')).toBe(true);
  });

  it('answers with a 503, Retry-After and no caching', async () => {
    process.env.MAINTENANCE_MODE = '1';
    try {
      const response = await proxy(request('/shop'));
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('3600');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-middleware-rewrite')).toContain('/maintenance');
    } finally {
      delete process.env.MAINTENANCE_MODE;
    }
  });

  it('still protects the console while in maintenance', async () => {
    process.env.MAINTENANCE_MODE = '1';
    try {
      expect((await proxy(request('/admin/orders'))).status).toBe(307);
    } finally {
      delete process.env.MAINTENANCE_MODE;
    }
  });
});

describe('proxy matcher', () => {
  // Next.js matcher sources are path patterns; this one is also a valid regular expression.
  const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

  it('covers pages, the console and dotted route handlers', async () => {
    for (const path of [
      '/',
      '/shop/shirts',
      '/admin',
      '/admin/orders',
      '/admin/exports/orders.csv',
      '/shop/x-1.5',
      // file-like paths inside the dynamic sections are never skipped
      '/admin/x.png',
      '/api/export.svg',
      '/checkout/receipt.ico',
      '/account/avatar.webp',
    ]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('skips Next.js internals and static assets', async () => {
    for (const path of [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/favicon.ico',
      '/logo.svg',
      '/seed/sand.svg',
      '/robots.txt',
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });
});

describe('slug redirects in the proxy', () => {
  it('sends a moved product page to its new address with a 301 and keeps the query string', async () => {
    lookup.resolveRedirect.mockResolvedValue({ to: '/products/oxford-shirt-2', status: 301 });
    const response = await proxy(request('/products/oxford-shirt?utm_source=mail'));
    expect(response.status).toBe(301);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/products/oxford-shirt-2');
    expect(location.search).toBe('?utm_source=mail');
    expect(lookup.resolveRedirect).toHaveBeenCalledWith('/products/oxford-shirt');
  });

  it('only looks up product, collection and category paths', async () => {
    for (const path of ['/', '/shop', '/api/health', '/admin/products', '/maintenance']) {
      await proxy(request(path));
    }
    expect(lookup.resolveRedirect).not.toHaveBeenCalled();
    for (const path of ['/products/a', '/collections/b', '/shop/tops/shirts']) {
      await proxy(request(path));
    }
    expect(lookup.resolveRedirect).toHaveBeenCalledTimes(3);
  });

  it('never redirects writes and never fails a page view when the lookup breaks', async () => {
    lookup.resolveRedirect.mockResolvedValue({ to: '/products/new', status: 301 });
    const post = new NextRequest('http://localhost:3000/products/old', { method: 'POST' });
    expect((await proxy(post)).status).not.toBe(301);
    lookup.resolveRedirect.mockRejectedValue(new Error('database down'));
    const response = await proxy(request('/products/old'));
    expect(response.headers.get('location')).toBeNull();
  });
});
