export type CheckResult =
  | { status: 'ok'; latencyMs: number }
  | { status: 'skipped'; reason: string }
  | { status: 'down'; latencyMs: number; error: string };

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  checks: { database: CheckResult; redis: CheckResult };
  version: string;
  uptimeSeconds: number;
}

const TIMEOUT_MS = 2_000;

/** Runs one probe with a deadline. Never throws; error text is generic so nothing leaks. */
export async function probe(run: () => Promise<unknown>): Promise<CheckResult> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
      }),
    ]);
    return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The database is required: without it the shop cannot take orders, so the service is `down`.
 * Redis only backs rate limiting and counters and falls back to memory, so losing it is `degraded`.
 */
export function summarize(
  database: CheckResult,
  redis: CheckResult,
  meta: { version: string; uptimeSeconds: number },
): HealthReport {
  const status = database.status === 'down' ? 'down' : redis.status === 'down' ? 'degraded' : 'ok';
  return { status, checks: { database, redis }, ...meta };
}
