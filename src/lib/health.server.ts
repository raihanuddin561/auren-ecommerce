import 'server-only';
import { db } from './db';
import { probe, summarize, type CheckResult, type HealthReport } from './health';
import { getRedis } from './redis';

/** Probes the database and (when configured) Redis, and summarises the result. */
export async function runHealthChecks(): Promise<HealthReport> {
  const redis = getRedis();
  const [database, redisCheck] = await Promise.all([
    probe(() => db.$queryRaw`SELECT 1`),
    redis
      ? probe(() => redis.ping())
      : Promise.resolve<CheckResult>({ status: 'skipped', reason: 'not configured' }),
  ]);

  return summarize(database, redisCheck, {
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    uptimeSeconds: Math.round(process.uptime()),
  });
}

// Anonymous callers must not be able to turn the health endpoint into database load: one probe at
// a time, reused for a few seconds.
const CACHE_MS = 10_000;
let cached: { at: number; report: Promise<HealthReport> } | null = null;

export function getCachedHealth(): Promise<HealthReport> {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_MS) {
    const entry = { at: now, report: runHealthChecks() };
    cached = entry;
    entry.report.catch(() => {
      if (cached === entry) cached = null;
    });
  }
  return cached.report;
}

/** Test hook: forget the cached report. */
export const resetHealthCacheForTests = (): void => {
  cached = null;
};
