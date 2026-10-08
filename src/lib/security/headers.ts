/**
 * Security response headers. Pure functions, no server-only imports, so next.config.ts can use them.
 *
 * Two Content-Security-Policy regimes (ADR-022, which supersedes ADR-016):
 *  - Storefront (prerendered, cached): a static header from next.config with inline bootstrap
 *    scripts allowed, because a prerendered shell is built before any request exists.
 *  - Dynamic sections (/admin, /checkout, /account, /api): rendered per request, so proxy.ts
 *    issues a fresh nonce for each response and the policy uses 'nonce-...' + 'strict-dynamic'
 *    with no 'unsafe-inline' for scripts.
 */

export interface CspOptions {
  isDev: boolean;
  /** Public origin of the site, used to decide whether to upgrade insecure requests. */
  appUrl: string;
  /** Sentry DSN (public), to allow the browser SDK to reach its ingest host. */
  sentryDsn?: string | undefined;
  /** Cloudflare Turnstile bot check is configured: allow its script and challenge frame. */
  turnstile?: boolean | undefined;
  /** Optional per-request nonce for fully dynamic deployments; adds 'strict-dynamic'. */
  nonce?: string | undefined;
}

/** Public product images in Vercel Blob (ADR-026). Uploads go through the server, so connect-src needs nothing. */
const BLOB_IMAGES = 'https://*.public.blob.vercel-storage.com';

function sentryHost(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const { hostname } = new URL(dsn);
    return hostname.includes('.') ? `https://${hostname}` : null;
  } catch {
    return null;
  }
}

const isHttps = (url: string) => url.startsWith('https://');

const TURNSTILE = 'https://challenges.cloudflare.com';

export function buildCsp({ isDev, appUrl, sentryDsn, nonce, turnstile }: CspOptions): string {
  const sentry = sentryHost(sentryDsn);
  const scriptSrc = [
    "'self'",
    nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    ...(turnstile ? [TURNSTILE] : []),
  ];
  const connectSrc = [
    "'self'",
    ...(sentry ? [sentry] : []),
    ...(isDev ? ['ws://localhost:*'] : []),
  ];

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'blob:', 'data:', 'https:', BLOB_IMAGES]],
    ['media-src', ["'self'", BLOB_IMAGES]],
    ['font-src', ["'self'"]],
    ['connect-src', connectSrc],
    ['frame-src', turnstile ? [TURNSTILE] : ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    // With a nonce there is no unsafe-inline, so inline event handlers are refused: say so.
    ...(nonce ? ([['script-src-attr', ["'none'"]]] as Array<[string, string[]]>) : []),
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  // Upgrading would break http://localhost production builds used in local checks and E2E runs.
  if (isHttps(appUrl)) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export interface SecurityHeader {
  key: string;
  value: string;
}

export function securityHeaders(options: CspOptions & { isProduction: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: buildCsp(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: PERMISSIONS_POLICY,
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ];
  // HSTS on http://localhost would pin browsers to https for the dev host; production only.
  // No `preload`: submitting to the preload list is hard to undo, so that is an owner decision.
  if (options.isProduction && isHttps(options.appUrl)) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }
  return headers;
}

// ---------------------------------------------------------------------------------------------
// Sections and header rules (ADR-022)
// ---------------------------------------------------------------------------------------------

/** Path prefixes that are rendered per request and therefore get a per-request nonce. */
export const NONCE_SECTIONS = ['/admin', '/checkout', '/account', '/api'] as const;

/** Decoded, lower-cased and de-duplicated slashes, so /%61dmin, /ADMIN and //admin are /admin. */
function normalizePath(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // keep the raw path: malformed escapes cannot match a section by accident
  }
  return decoded.toLowerCase().replace(/\/{2,}/g, '/');
}

const underPrefix = (pathname: string, prefix: string) => {
  const path = normalizePath(pathname);
  return path === prefix || path.startsWith(`${prefix}/`);
};

export const isNonceSection = (pathname: string): boolean =>
  NONCE_SECTIONS.some((prefix) => underPrefix(pathname, prefix));

export const isApi = (pathname: string): boolean => underPrefix(pathname, '/api');

/** API responses are data, not documents: nothing may load or frame them. */
export const API_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** The policy a dynamic section gets for one request. */
export function dynamicSectionCsp(pathname: string, nonce: string, options: CspOptions): string {
  return isApi(pathname) ? API_CSP : buildCsp({ ...options, nonce });
}

/** A fresh, unguessable nonce (128 bits) for one response. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Pages whose URL carries a one-time token (reset password, verify email, guest order tracking):
 * the address must never leak through the Referer header.
 */
export const TOKEN_PAGE_PREFIXES = ['/reset-password', '/verify-email', '/track'] as const;

export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=(self)',
  'bluetooth=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'interest-cohort=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=(self)',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

export interface HeaderRule {
  source: string;
  headers: SecurityHeader[];
}

const alternatives = (prefixes: readonly string[]) => prefixes.map((p) => p.slice(1)).join('|');

/** path-to-regexp source matching everything outside the given prefixes. */
const outside = (prefixes: readonly string[]) => `/((?!(?:${alternatives(prefixes)})(?:/|$)).*)`;

/** path-to-regexp source matching the given prefixes and anything below them. */
const inside = (prefixes: readonly string[]) => `/:section(${alternatives(prefixes)})/:rest*`;

/**
 * Header rules for next.config.ts. Every path matches exactly one rule per header name, so the
 * result never depends on how Next.js orders overlapping rules.
 */
export function headerRules(options: CspOptions & { isProduction: boolean }): HeaderRule[] {
  const baseline = securityHeaders(options).filter(
    (h) => h.key !== 'Content-Security-Policy' && h.key !== 'Referrer-Policy',
  );
  return [
    { source: '/:path*', headers: baseline },
    // Static policy for the prerendered storefront only.
    {
      source: outside(NONCE_SECTIONS),
      headers: [{ key: 'Content-Security-Policy', value: buildCsp(options) }],
    },
    // Dynamic sections get their nonce policy from proxy.ts; they are also never embedded
    // cross-origin.
    {
      source: inside(NONCE_SECTIONS),
      headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
    },
    {
      source: outside(TOKEN_PAGE_PREFIXES),
      headers: [{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }],
    },
    {
      source: inside(TOKEN_PAGE_PREFIXES),
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    },
  ];
}
