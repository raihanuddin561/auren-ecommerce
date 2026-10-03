import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { AUTH_COOKIE_PREFIX } from '@/lib/auth-constants';
import {
  API_CSP,
  buildCsp,
  dynamicSectionCsp,
  isApi,
  isNonceSection,
  newNonce,
} from '@/lib/security/headers';
import { isStaffBypassAllowed } from '@/lib/test-bypass';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/sign-in']);
const MAINTENANCE_PATH = '/maintenance';
/** API routes that must keep working while the storefront is in maintenance. */
const MAINTENANCE_OPEN_API = ['/api/health', '/api/webhooks', '/api/inngest', '/api/auth'];

/**
 * During maintenance the storefront shows the maintenance page. Staff sign-in and the console stay
 * reachable, and health checks, payment webhooks, background jobs and auth keep working: those
 * must never be blocked. Maintenance never changes an order (nothing is cancelled).
 */
export function isUnderMaintenance(pathname: string, maintenanceMode: string | undefined): boolean {
  if (maintenanceMode !== '1') return false;
  if (pathname === MAINTENANCE_PATH) return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false;
  // The security contact (RFC 9116) must stay reachable, especially during an incident.
  if (pathname.startsWith('/.well-known/')) return false;
  if (
    MAINTENANCE_OPEN_API.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return false;
  }
  return true;
}

/**
 * Dynamic sections (/admin, /checkout, /account, /api) get a fresh nonce and a nonce-based CSP for
 * every request (ADR-022). Next.js reads the nonce from the request's CSP header and puts it on
 * its own scripts; server components that emit inline scripts read `x-nonce`.
 */
const cspOptions = () => ({
  isDev: process.env.NODE_ENV === 'development',
  appUrl: process.env.APP_URL?.trim() || 'http://localhost:3000',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
});

const maintenanceCsp = (pathname: string): string =>
  isApi(pathname) ? API_CSP : buildCsp(cspOptions());

export function nextWithSecurityHeaders(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (!isNonceSection(pathname)) return NextResponse.next();
  const nonce = newNonce();
  const csp = dynamicSectionCsp(pathname, nonce, cspOptions());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  // A nonce must never be replayed: these responses are per request and per user.
  if (!isApi(pathname)) {
    response.headers.set('cache-control', 'private, no-store');
    response.headers.append('vary', 'Cookie');
  }
  return response;
}

/**
 * Request-boundary proxy. The admin gate here is deliberately cheap (is there a session cookie?);
 * the real checks (staff record, active, two-factor, permissions) run in the admin layout and in
 * every action through requireStaff() and assertPermission().
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isUnderMaintenance(pathname, process.env.MAINTENANCE_MODE)) {
    const response = NextResponse.rewrite(new URL(MAINTENANCE_PATH, request.url), { status: 503 });
    // The maintenance page is prerendered, so it takes the static policy (or the API policy for
    // /api paths) whatever section the request was for.
    response.headers.set('content-security-policy', maintenanceCsp(pathname));
    response.headers.set('Retry-After', '3600');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  if (
    pathname.startsWith('/admin') &&
    !PUBLIC_ADMIN_PATHS.has(pathname) &&
    !isStaffBypassAllowed(request.headers)
  ) {
    const hasSession = getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX });
    if (!hasSession) {
      const signIn = new URL('/admin/sign-in', request.url);
      signIn.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(signIn);
    }
  }

  return nextWithSecurityHeaders(request);
}

export const config = {
  // Everything except static files and Next.js internals (paths with a file extension are assets).
  // Everything except Next.js internals and known static assets. Paths with other dots (route
  // handlers such as /admin/exports/orders.csv, slugs like x-1.5) still pass through the proxy.
  matcher: [
    // Never skipped inside /admin, /api, /checkout and /account: a file-like path there (a slug
    // ending in .png, a route handler returning SVG) still needs the session gate and the CSP.
    '/((?!_next/static|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$|seed/)(?:(?:admin|api|checkout|account)(?:/.*)?$|(?!.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*))',
  ],
};
