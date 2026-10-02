/**
 * Security response headers. Pure functions, no server-only imports, so next.config.ts can use them.
 *
 * The Content-Security-Policy deliberately has no per-request nonce: Next.js documents nonce based
 * CSP as incompatible with Partial Prerendering, which ADR-005 (Cache Components) relies on for
 * fast cached storefront pages. See ADR-016. Scripts are limited to our own origin plus inline
 * bootstrap scripts; every other directive is locked down. `buildCsp` still accepts a nonce so the
 * policy can be tightened without touching callers if Next.js lifts the restriction.
 */

export interface CspOptions {
  isDev: boolean;
  /** Public origin of the site, used to decide whether to upgrade insecure requests. */
  appUrl: string;
  /** Sentry DSN (public), to allow the browser SDK to reach its ingest host. */
  sentryDsn?: string | undefined;
  /** Optional per-request nonce for fully dynamic deployments; adds 'strict-dynamic'. */
  nonce?: string | undefined;
}

const CLOUDINARY = 'https://res.cloudinary.com';

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

export function buildCsp({ isDev, appUrl, sentryDsn, nonce }: CspOptions): string {
  const sentry = sentryHost(sentryDsn);
  const scriptSrc = [
    "'self'",
    nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
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
    ['img-src', ["'self'", 'blob:', 'data:', CLOUDINARY]],
    ['media-src', ["'self'", CLOUDINARY]],
    ['font-src', ["'self'"]],
    ['connect-src', connectSrc],
    ['frame-src', ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
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
      value: 'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()',
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
