import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { AUTH_COOKIE_PREFIX } from '@/lib/auth-constants';
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
  if (
    MAINTENANCE_OPEN_API.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return false;
  }
  return true;
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

  return NextResponse.next();
}

export const config = {
  // Everything except static files and Next.js internals (paths with a file extension are assets).
  // Everything except Next.js internals and known static assets. Paths with other dots (route
  // handlers such as /admin/exports/orders.csv, slugs like x-1.5) still pass through the proxy.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|seed/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
};
