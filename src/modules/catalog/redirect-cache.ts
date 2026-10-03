/**
 * In-process snapshot of the redirects table, used by the request proxy. The table is small (one row
 * per slug change), so the whole of it is loaded at once and every lookup is a map read: a scan of
 * random addresses costs nothing. The snapshot expires quickly and is cleared whenever this server
 * process writes a slug change; other instances catch up within the time to live.
 */

export interface CachedRedirect {
  to: string;
  status: 301 | 302;
}

const TTL_MS = 15_000;
/** The most rows kept; the proxy ignores redirects beyond this (the table should never get near). */
export const SNAPSHOT_LIMIT = 5_000;

interface Snapshot {
  map: Map<string, CachedRedirect>;
  expires: number;
}

let snapshot: Snapshot | null = null;

/** The current snapshot, or undefined when it is missing or expired. */
export function readRedirectSnapshot(now = Date.now()): Map<string, CachedRedirect> | undefined {
  return snapshot && snapshot.expires > now ? snapshot.map : undefined;
}

/** The last snapshot even when expired (used when the database cannot be reached). */
export function staleRedirectSnapshot(): Map<string, CachedRedirect> | undefined {
  return snapshot?.map;
}

export function writeRedirectSnapshot(
  rows: ReadonlyArray<{ fromPath: string; toPath: string; statusCode: number }>,
  now = Date.now(),
): Map<string, CachedRedirect> {
  const map = new Map<string, CachedRedirect>();
  for (const row of rows) {
    // A target must stay on this site: one slash, no scheme, no backslash.
    if (!isSafeRedirectTarget(row.toPath) || row.toPath === row.fromPath) continue;
    map.set(row.fromPath, { to: row.toPath, status: row.statusCode === 302 ? 302 : 301 });
  }
  snapshot = { map, expires: now + TTL_MS };
  return map;
}

export function clearRedirectCache(): void {
  snapshot = null;
}

/** Same-site absolute path only: "/products/x", never "//host", "/\\host" or "https://host". */
export const isSafeRedirectTarget = (path: string): boolean =>
  path.length <= 300 && /^\/(?![/\\])[^\s\\]*$/.test(path);

/** Paths the proxy looks up: product, collection and category pages. Everything else is skipped. */
export const REDIRECTABLE_PREFIXES = ['/products/', '/collections/', '/shop/'] as const;

export const isRedirectablePath = (pathname: string): boolean =>
  pathname.length <= 300 && REDIRECTABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
