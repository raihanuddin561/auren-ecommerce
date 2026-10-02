import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMITS,
  UNKNOWN_ADDRESS_FACTOR,
  hashIdentifier,
  limiterForAuthRequest,
  memoryLimit,
  rateLimit,
  resetMemoryLimits,
  tooManyRequests,
} from '../rate-limit';
import { clientIp, defaultTrustedProxy, normalizeIp } from '../request-meta';
import { buildCsp, securityHeaders } from '../security/headers';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const base = { isDev: false, appUrl: 'https://auren.com.bd' };

describe('Content-Security-Policy', () => {
  const directive = (csp: string, name: string) =>
    csp
      .split('; ')
      .find((part) => part.startsWith(`${name} `))
      ?.slice(name.length + 1);

  it('locks down everything it does not need', () => {
    const csp = buildCsp(base);
    expect(directive(csp, 'default-src')).toBe("'self'");
    expect(directive(csp, 'object-src')).toBe("'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("'none'");
    expect(directive(csp, 'frame-src')).toBe("'none'");
    expect(directive(csp, 'base-uri')).toBe("'self'");
    expect(directive(csp, 'form-action')).toBe("'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('allows inline bootstrap scripts but never eval in production', () => {
    expect(directive(buildCsp(base), 'script-src')).toBe("'self' 'unsafe-inline'");
  });

  it('adds eval and websockets for the development server only', () => {
    const csp = buildCsp({ ...base, isDev: true, appUrl: 'http://localhost:3000' });
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toContain('ws://localhost:*');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('supports a per-request nonce with strict-dynamic when a deployment can use one', () => {
    const csp = buildCsp({ ...base, nonce: 'abc123' });
    expect(directive(csp, 'script-src')).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(directive(csp, 'script-src')).not.toContain('unsafe-inline');
  });

  it('lets the browser reach only the Sentry host from the DSN, and Cloudinary for images', () => {
    const csp = buildCsp({ ...base, sentryDsn: 'https://key@o1.ingest.de.sentry.io/42' });
    expect(directive(csp, 'connect-src')).toBe("'self' https://o1.ingest.de.sentry.io");
    expect(directive(csp, 'img-src')).toContain('https://res.cloudinary.com');
    expect(buildCsp({ ...base, sentryDsn: 'not a url' })).not.toContain('sentry');
  });
});

describe('security headers', () => {
  const names = (headers: Array<{ key: string }>) => headers.map((h) => h.key);

  it('sends the full baseline in production', () => {
    const headers = securityHeaders({ ...base, isProduction: true });
    expect(names(headers)).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Cross-Origin-Opener-Policy',
      ]),
    );
    const hsts = headers.find((h) => h.key === 'Strict-Transport-Security');
    expect(hsts?.value).toMatch(/max-age=63072000; includeSubDomains/);
    expect(headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
  });

  it('does not pin http://localhost to https', () => {
    expect(
      names(securityHeaders({ isDev: false, appUrl: 'http://localhost:3000', isProduction: true })),
    ).not.toContain('Strict-Transport-Security');
    expect(names(securityHeaders({ ...base, isDev: true, isProduction: false }))).not.toContain(
      'Strict-Transport-Security',
    );
  });
});

describe('client address', () => {
  const headersOf = (init: Record<string, string>) => new Headers(init);

  it('prefers platform headers over a forgeable x-forwarded-for', () => {
    const vercel = headersOf({
      'x-vercel-forwarded-for': '198.51.100.9',
      'x-forwarded-for': '6.6.6.6',
    });
    expect(clientIp(vercel, 'vercel')).toBe('198.51.100.9');
    expect(clientIp(vercel, 'forwarded')).toBe('198.51.100.9');
    expect(clientIp(headersOf({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '6.6.6.6' }))).toBe(
      '198.51.100.7',
    );
  });

  it('only trusts x-forwarded-for when the deployment says a proxy rewrites it', () => {
    const forged = headersOf({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIp(forged, 'forwarded')).toBe('203.0.113.5');
    expect(clientIp(forged, 'vercel')).toBeNull();
    expect(clientIp(forged, 'none')).toBeNull();
    expect(clientIp(headersOf({}), 'forwarded')).toBeNull();
  });

  it('rejects values that are not IP addresses and collapses IPv6 to its /64', () => {
    expect(normalizeIp('not-an-ip')).toBeNull();
    expect(normalizeIp('1.2.3.4; DROP TABLE')).toBeNull();
    expect(normalizeIp('x'.repeat(100))).toBeNull();
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(' 203.0.113.5 ')).toBe('203.0.113.5');
    expect(normalizeIp('2001:db8:abcd:12:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:abcd:12::/64');
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(normalizeIp('2001:db8:abcd:12:1::1')).toBe(normalizeIp('2001:db8:abcd:12:2::2'));
  });

  it('chooses a safe default per hosting environment', () => {
    expect(defaultTrustedProxy({ vercel: true, production: true })).toBe('vercel');
    expect(defaultTrustedProxy({ vercel: false, production: true })).toBe('none');
    expect(defaultTrustedProxy({ vercel: false, production: false })).toBe('forwarded');
  });
});

describe('memory rate limiter', () => {
  beforeEach(() => resetMemoryLimits());

  it('allows up to the limit, then blocks with a retry hint', () => {
    const t0 = 1_000_000;
    for (let i = 1; i <= 5; i++) {
      const result = memoryLimit('login:1.2.3.4', 5, 60, t0 + i);
      expect(result).toMatchObject({ success: true, remaining: 5 - i });
    }
    const blocked = memoryLimit('login:1.2.3.4', 5, 60, t0 + 10_000);
    expect(blocked).toMatchObject({ success: false, remaining: 0 });
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(49);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('frees capacity as the window slides', () => {
    const t0 = 5_000_000;
    for (let i = 0; i < 3; i++) memoryLimit('k', 3, 60, t0);
    expect(memoryLimit('k', 3, 60, t0 + 30_000).success).toBe(false);
    expect(memoryLimit('k', 3, 60, t0 + 61_000).success).toBe(true);
  });

  it('keeps callers independent', () => {
    for (let i = 0; i < 5; i++) memoryLimit('login:a', 5, 60);
    expect(memoryLimit('login:a', 5, 60).success).toBe(false);
    expect(memoryLimit('login:b', 5, 60).success).toBe(true);
  });

  it('uses the configured preset through rateLimit() when Redis is absent', async () => {
    const { limit } = RATE_LIMITS.login;
    for (let i = 0; i < limit; i++) {
      expect((await rateLimit('login', '9.9.9.9')).success).toBe(true);
    }
    const blocked = await rateLimit('login', '9.9.9.9');
    expect(blocked.success).toBe(false);
    expect((await rateLimit('login', '8.8.8.8')).success).toBe(true);
  });

  it('gives callers with an unknown address one shared, more generous bucket', async () => {
    const { limit } = RATE_LIMITS.login;
    for (let i = 0; i < limit * UNKNOWN_ADDRESS_FACTOR; i++) {
      expect((await rateLimit('login', null)).success).toBe(true);
    }
    expect((await rateLimit('login', null)).success).toBe(false);
  });

  it('hashes account identifiers so emails never become cache keys', () => {
    expect(hashIdentifier(' Rahim@Auren.test ')).toBe(hashIdentifier('rahim@auren.test'));
    expect(hashIdentifier('rahim@auren.test')).not.toContain('rahim');
    expect(hashIdentifier('a@b.com')).toHaveLength(32);
  });

  it('evicts the least recently used keys first', () => {
    resetMemoryLimits();
    memoryLimit('keep', 5, 60, 1_000);
    for (let i = 0; i < 10_050; i++) memoryLimit(`filler-${i}`, 5, 60, 1_000);
    memoryLimit('keep', 5, 60, 1_000); // touched again, so it is recent
    for (let i = 0; i < 200; i++) memoryLimit(`more-${i}`, 5, 60, 1_000);
    expect(memoryLimit('keep', 1, 60, 1_100).success).toBe(false); // its history survived
  });

  it('answers 429 with standard headers', async () => {
    const response = tooManyRequests({
      success: false,
      limit: 5,
      remaining: 0,
      retryAfterSeconds: 42,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});

describe('auth endpoint to limiter mapping', () => {
  it.each([
    ['POST', '/api/auth/sign-in/email', 'login'],
    ['POST', '/api/auth/sign-up/email', 'register'],
    ['POST', '/api/auth/request-password-reset', 'passwordReset'],
    ['POST', '/api/auth/reset-password', 'passwordReset'],
    ['POST', '/api/auth/send-verification-email', 'verificationEmail'],
    ['POST', '/api/auth/two-factor/verify-totp', 'twoFactor'],
    ['POST', '/api/auth/phone-number/verify', 'otp'],
    ['POST', '/api/auth/sign-in/phone-number', 'otp'],
    ['POST', '/api/auth/change-password', 'authMutation'],
    ['POST', '/api/auth/delete-user', 'authMutation'],
    ['POST', '/api/auth/two-factor/disable', 'twoFactor'],
    ['GET', '/api/auth/get-session', 'authGeneral'],
    ['POST', '/api/auth/sign-out', 'authMutation'],
  ] as const)('%s %s uses %s', (method, path, expected) => {
    expect(limiterForAuthRequest(method, path)).toBe(expected);
  });

  it('keeps every sign-in style limit at or below the documented numbers', () => {
    expect(RATE_LIMITS.login.limit).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThanOrEqual(3);
  });
});

describe('auth route handler', () => {
  it('blocks the sixth sign-in attempt from one address before Better Auth runs', async () => {
    resetMemoryLimits();
    const handler = vi.fn(async () => Response.json({ ok: true }));
    vi.doMock('@/lib/auth', () => ({ auth: {} }));
    vi.doMock('better-auth/next-js', () => ({
      toNextJsHandler: () => ({ GET: handler, POST: handler }),
    }));
    vi.resetModules();
    const { POST } = await import('../../app/api/auth/[...all]/route');
    const attempt = (ip: string) =>
      POST(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
        }),
      );

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt('203.0.113.50')).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(handler).toHaveBeenCalledTimes(5);
    expect((await attempt('203.0.113.51')).status).toBe(200);

    // many addresses guessing one account run into the per-account limit
    resetMemoryLimits();
    const guess = (ip: string) =>
      POST(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'Victim@Auren.test', password: 'x' }),
        }),
      );
    const results: number[] = [];
    for (let i = 0; i < 12; i++) results.push((await guess(`198.51.100.${i + 1}`)).status);
    expect(results.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(results.slice(10)).toEqual([429, 429]);
    vi.doUnmock('better-auth/next-js');
    vi.doUnmock('@/lib/auth');
  }, 60_000);
});
