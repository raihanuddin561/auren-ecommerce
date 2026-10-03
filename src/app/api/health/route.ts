import { createHash, timingSafeEqual } from 'node:crypto';
import { connection } from 'next/server';
import { env } from '@/lib/env';
import { getCachedHealth } from '@/lib/health.server';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Compares fixed-length digests so neither the value nor its length leaks through timing. */
const sameSecret = (given: string | null, expected: string | undefined): boolean =>
  Boolean(given && expected) && timingSafeEqual(digest(given!), digest(expected!));

/**
 * Uptime monitor target. The public answer is only `{ status }` (and the HTTP status): which
 * dependency is down, latencies, version and uptime help an attacker, so they are returned only to
 * a caller that presents HEALTH_DETAIL_TOKEN as a bearer token (for the monitoring dashboard).
 */
export async function GET(request: Request) {
  // Always evaluated per request, never prerendered at build time.
  await connection();
  const report = await getCachedHealth();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const detailed = sameSecret(bearer, env.HEALTH_DETAIL_TOKEN);
  return Response.json(detailed ? report : { status: report.status }, {
    status: report.status === 'down' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
