import type { StaffContext } from './permissions';

/**
 * Test-only staff identity for Playwright runs that must render admin screens without a database
 * (visual snapshots, accessibility scans). Browser tests for those screens cannot sign in without
 * PostgreSQL, so they run against a server started with this flag.
 *
 * It can never be switched on for a real site. Every one of these must hold:
 *  - E2E_STAFF_BYPASS=1, which no deployment configures;
 *  - APP_URL is set explicitly and is localhost/127.0.0.1 (an unset URL does not count);
 *  - the process is not on Vercel;
 *  - the request itself is local: its Host is localhost/127.0.0.1 and it carries no proxy
 *    headers (x-real-ip, x-vercel-*, forwarded) and any x-forwarded-for is loopback only, so a
 *    server behind a reverse proxy that passes real client addresses never honours it;
 *  - `parseServerEnv` refuses to boot (next dev, build and start all run it) when the flag is set
 *    with a non-local or missing APP_URL or on Vercel, and warns loudly when it is active.
 *
 * The identity it grants has no permissions at all, so it cannot read or change business data.
 * The decision is a pure function so it can be tested exhaustively.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type EnvSource = Record<string, string | undefined>;

interface HeaderReader {
  get(name: string): string | null;
}

// Next.js sets x-forwarded-for/-host/-port/-proto itself from the socket on every request, so a
// direct local connection carries x-forwarded-for with a loopback address. Only the headers below
// prove that something sat in front of the server.
const PROXY_HEADERS = ['x-real-ip', 'forwarded', 'x-vercel-id', 'x-vercel-forwarded-for'] as const;

/** True only for an explicit URL whose host is local. An empty or malformed URL is not local. */
export function isLocalAppUrl(appUrl: string | undefined): boolean {
  if (!appUrl?.trim()) return false;
  try {
    return LOCAL_HOSTS.has(new URL(appUrl.trim()).hostname);
  } catch {
    return false;
  }
}

function hostnameOf(hostHeader: string | null): string {
  if (!hostHeader) return '';
  const value = hostHeader.trim().toLowerCase();
  // [::1]:3000 keeps its brackets; host:port loses the port.
  return value.startsWith('[') ? value.slice(0, value.indexOf(']') + 1) : value.split(':')[0]!;
}

const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

/** True when there is no x-forwarded-for, or every address in it is the loopback address. */
function forwardedForIsLoopback(value: string | null): boolean {
  if (value === null) return true;
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .every((address) => LOOPBACK.has(address));
}

/** Environment-level check: flag, explicit local APP_URL, not Vercel. */
export function isStaffBypassConfigured(env: EnvSource = process.env): boolean {
  if (env.E2E_STAFF_BYPASS !== '1') return false;
  if (env.VERCEL_ENV || env.VERCEL) return false;
  return isLocalAppUrl(env.APP_URL);
}

/** Full check for one request: configured, a local Host, and no proxy in front. */
export function isStaffBypassAllowed(headers: HeaderReader, env: EnvSource = process.env): boolean {
  if (!isStaffBypassConfigured(env)) return false;
  if (!LOCAL_HOSTS.has(hostnameOf(headers.get('host')))) return false;
  if (!PROXY_HEADERS.every((name) => headers.get(name) === null)) return false;
  return forwardedForIsLoopback(headers.get('x-forwarded-for'));
}

/** Why a requested bypass is unsafe, or null when the configuration is acceptable. */
export function staffBypassConfigurationError(env: EnvSource): string | null {
  if (env.E2E_STAFF_BYPASS === undefined || env.E2E_STAFF_BYPASS.trim() === '') return null;
  if (env.E2E_STAFF_BYPASS !== '1') return 'E2E_STAFF_BYPASS must be unset or "1"';
  if (env.VERCEL_ENV || env.VERCEL) {
    return 'E2E_STAFF_BYPASS is test-only and must never be set on Vercel';
  }
  if (!isLocalAppUrl(env.APP_URL)) {
    return 'E2E_STAFF_BYPASS is test-only and requires APP_URL to be set to localhost';
  }
  return null;
}

/** Identity used by the bypass: a staff member with no permissions. */
export const BYPASS_STAFF: StaffContext = {
  id: 'e2e-bypass-staff',
  userId: 'e2e-bypass-user',
  role: 'support',
  name: 'Test Staff',
  email: 'test-staff@auren.invalid',
  permissions: new Set(),
};
