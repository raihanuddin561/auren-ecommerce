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
