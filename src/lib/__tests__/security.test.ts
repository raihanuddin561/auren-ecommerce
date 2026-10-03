import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAttemptMemory } from '../attempts';
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
    expect(directive(csp, 'img-src')).toContain('https://*.public.blob.vercel-storage.com');
    expect(csp).not.toContain('cloudinary');
    expect(directive(csp, 'connect-src')).not.toContain('blob.vercel-storage.com');
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

  it('counts addresses from the right when a number of own proxies is configured', () => {
    // The client sent 6.6.6.6 itself; our single proxy appended the address it actually saw.
    const chain = headersOf({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5' });
    expect(clientIp(chain, 'hops:1')).toBe('203.0.113.5');
    // Two proxies of ours: the right-most is the inner proxy, the one before it is the client.
    const twoProxies = headersOf({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4, 10.0.0.9' });
    expect(clientIp(twoProxies, 'hops:2')).toBe('198.51.100.4');
    // A shorter chain than configured, or garbage, is an unknown address (never the first entry).
    expect(clientIp(headersOf({ 'x-forwarded-for': '203.0.113.5' }), 'hops:2')).toBeNull();
    expect(clientIp(headersOf({ 'x-forwarded-for': 'junk, not-an-ip' }), 'hops:1')).toBeNull();
    expect(clientIp(headersOf({}), 'hops:1')).toBeNull();
    // Platform headers are ignored in hop mode: only our own proxies speak for the client.
    expect(
      clientIp(headersOf({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '203.0.113.5' }), 'hops:1'),
    ).toBe('203.0.113.5');
  });

  it('on Vercel uses only the platform header', () => {
    expect(
      clientIp(headersOf({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '6.6.6.6' }), 'vercel'),
    ).toBeNull();
  });

  it('only trusts x-forwarded-for when the deployment says a proxy rewrites it', () => {
    const forged = headersOf({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIp(forged, 'forwarded')).toBe('203.0.113.5');
    expect(clientIp(forged, 'vercel')).toBeNull();
    expect(clientIp(forged, 'none')).toBeNull();
    expect(clientIp(headersOf({}), 'forwarded')).toBeNull();
  });

  it('treats an IPv4-mapped IPv6 address as the IPv4 client and rejects zone ids', () => {
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('::FFFF:198.51.100.7')).toBe('198.51.100.7');
    expect(normalizeIp('::ffff:999.1.1.1')).toBeNull();
    // the hex spelling of the same mapped address, and leading zeros in groups
    expect(normalizeIp('::ffff:cb00:7105')).toBe('203.0.113.5');
    expect(normalizeIp('0:0:0:0:0:ffff:cb00:7105')).toBe('203.0.113.5');
    expect(normalizeIp('2001:0db8:abcd:0012::1')).toBe('2001:db8:abcd:12::/64');
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
    expect(normalizeIp('1::2::3')).toBeNull();
    expect(normalizeIp('fe80::1%eth0')).toBeNull();
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

  it('gives callers with an unknown address one shared bucket that is smaller than a located caller', async () => {
    const { limit } = RATE_LIMITS.login;
    const shared = Math.ceil(limit * UNKNOWN_ADDRESS_FACTOR);
    expect(shared).toBeLessThan(limit);
    for (let i = 0; i < shared; i++) {
      expect((await rateLimit('login', null)).success).toBe(true);
    }
    expect((await rateLimit('login', null)).success).toBe(false);
    // a located caller is unaffected by the shared bucket
    expect((await rateLimit('login', '203.0.113.77')).success).toBe(true);
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
  const load = async (respond: (request: Request) => Response | Promise<Response>) => {
    resetMemoryLimits();
    resetAttemptMemory();
    const handler = vi.fn(async (request: Request) => respond(request));
    vi.doMock('@/lib/auth', () => ({ auth: {} }));
    vi.doMock('better-auth/next-js', () => ({
      toNextJsHandler: () => ({ GET: handler, POST: handler }),
    }));
    vi.resetModules();
    const { POST } = await import('../../app/api/auth/[...all]/route');
    return { POST, handler };
  };
  const signIn = (ip: string, body?: unknown, extra: Record<string, string> = {}) =>
    new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip, 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  afterEach(() => {
    vi.doUnmock('better-auth/next-js');
    vi.doUnmock('@/lib/auth');
  });

  it('blocks the sixth sign-in attempt from one address before Better Auth runs', async () => {
    const { POST, handler } = await load(() => Response.json({ ok: true }));
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await POST(signIn('203.0.113.50', { email: `user${i}@auren.test`, password: 'x' })))
          .status,
      );
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(handler).toHaveBeenCalledTimes(5);
    expect(
      (await POST(signIn('203.0.113.51', { email: 'user9@auren.test', password: 'x' }))).status,
    ).toBe(200);
  }, 60_000);

  it('delays an account after repeated wrong passwords, from any address, and counts failures only', async () => {
    const { POST, handler } = await load(() => Response.json({ error: 'bad' }, { status: 401 }));
    const guess = (n: number) =>
      POST(signIn(`198.51.100.${n}`, { email: 'Victim@Auren.test', password: 'x' }));

    // three wrong passwords from three different addresses are free, the fourth is delayed
    expect([(await guess(1)).status, (await guess(2)).status, (await guess(3)).status]).toEqual([
      401, 401, 401,
    ]);
    const delayed = await guess(4);
    expect(delayed.status).toBe(429);
    expect(Number(delayed.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(handler).toHaveBeenCalledTimes(3);

    // a different account is not affected
    const other = await POST(signIn('198.51.100.9', { email: 'other@auren.test', password: 'x' }));
    expect(other.status).toBe(401);
  }, 60_000);

  it('never slows down a user who signs in correctly, and a success clears earlier mistakes', async () => {
    let wrong = true;
    const { POST } = await load(() =>
      wrong ? Response.json({}, { status: 401 }) : Response.json({ ok: true }),
    );
    const attempt = (n: number) =>
      POST(signIn(`192.0.2.${n}`, { email: 'rahim@auren.test', password: 'x' }));
    expect((await attempt(1)).status).toBe(401);
    expect((await attempt(2)).status).toBe(401);
    wrong = false;
    for (let i = 3; i < 13; i++) expect((await attempt(i)).status).toBe(200);
    // the counter was cleared by the success: two more mistakes are still free
    wrong = true;
    expect((await attempt(20)).status).toBe(401);
    expect((await attempt(21)).status).toBe(401);
    expect((await attempt(22)).status).toBe(401);
  }, 60_000);

  it('refuses sign-in requests that cannot be tied to an account, so none escapes the delay', async () => {
    const { POST, handler } = await load(() => Response.json({ ok: true }));
    const form = new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.90',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'email=a@b.test&password=x',
    });
    expect((await POST(form)).status).toBe(400);
    expect((await POST(signIn('203.0.113.91', {}))).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  }, 60_000);

  it('caps the body by bytes received, not by the content-length header', async () => {
    const { POST, handler } = await load(() => Response.json({ ok: true }));
    const huge = { email: 'big@auren.test', password: 'x', padding: 'p'.repeat(20_000) };
    const response = await POST(signIn('203.0.113.92', huge));
    expect(response.status).toBe(413);
    // a body whose content-length lies is cut off the same way
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"email":"a@b.test","pad":"'));
        controller.enqueue(new Uint8Array(20_000).fill(120));
        controller.close();
      },
    });
    const lying = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.93', 'content-length': '10' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await POST(lying)).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  }, 60_000);

  it('treats the unverified-email response as a correct password, not a guess', async () => {
    const { POST } = await load(() => Response.json({}, { status: 403 }));
    for (let i = 1; i <= 5; i++) {
      const response = await POST(
        signIn(`192.0.2.${i}`, { email: 'new@auren.test', password: 'x' }),
      );
      expect(response.status).toBe(403);
    }
  }, 60_000);

  it('applies the same refusals to unknown and known accounts', async () => {
    const { POST } = await load(() => Response.json({}, { status: 401 }));
    for (const email of ['exists@auren.test', 'does-not-exist@auren.test']) {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        codes.push((await POST(signIn(`203.0.113.${i + 100}`, { email, password: 'x' }))).status);
      }
      expect(codes).toEqual([401, 401, 401, 429]);
    }
  }, 60_000);

  it('requires a Turnstile token for sign-in only when Turnstile is configured', async () => {
    vi.doMock('@/lib/turnstile', () => ({
      TURNSTILE_HEADER: 'x-turnstile-token',
      turnstileEnabled: () => true,
      verifyTurnstile: async (token: string | null) => token === 'good',
    }));
    try {
      const { POST, handler } = await load(() => Response.json({ ok: true }));
      const body = { email: 'rahim@auren.test', password: 'x' };
      const missing = await POST(signIn('203.0.113.60', body));
      expect(missing.status).toBe(400);
      expect(await missing.json()).toMatchObject({ error: { code: 'BOT_CHECK_FAILED' } });
      expect(handler).not.toHaveBeenCalled();
      expect(
        (await POST(signIn('203.0.113.60', body, { 'x-turnstile-token': 'good' }))).status,
      ).toBe(200);
    } finally {
      vi.doUnmock('@/lib/turnstile');
    }
  }, 60_000);
});
