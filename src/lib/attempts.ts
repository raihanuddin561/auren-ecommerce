import 'server-only';
import { logger } from './logger';
import { getRedis } from './redis';

/**
 * Attempt counters with progressive delay, for credentials that can be guessed (a password per
 * account, a step-up code per user). An attempt is RESERVED atomically before the credential is
 * checked (so a burst of parallel guesses cannot all slip through), and a correct answer clears
 * the counter: a legitimate user who signs in correctly is never slowed down.
 *
 *   free attempts, then base * 2^(n - free) seconds before the next try, capped at max.
 *
 * State lives in Upstash Redis when configured (shared by every instance) and in memory
 * otherwise. If Redis is configured but unreachable the check FAILS CLOSED: the caller is told to
 * wait, so an outage cannot be used to guess passwords without limit.
 */
export interface DelayPolicy {
  /** Wrong answers allowed before any delay applies. */
  freeAttempts: number;
  /** First delay, in seconds; doubles with every further failure. */
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  /** The counter is forgotten after this long without a failure. */
  windowSeconds: number;
}

export const DELAY_POLICIES = {
  /** Sign-in per account (hashed email), across every address. */
  login: { freeAttempts: 3, baseDelaySeconds: 15, maxDelaySeconds: 900, windowSeconds: 3600 },
  /** Re-entering a password or code for a sensitive staff action, per user. */
  stepUp: { freeAttempts: 3, baseDelaySeconds: 30, maxDelaySeconds: 900, windowSeconds: 3600 },
} as const satisfies Record<string, DelayPolicy>;

export type DelayPolicyName = keyof typeof DELAY_POLICIES;

export interface AttemptStatus {
  blocked: boolean;
  retryAfterSeconds: number;
  failures: number;
}

const UNAVAILABLE: AttemptStatus = { blocked: true, retryAfterSeconds: 30, failures: 0 };

/** Seconds to wait after `failures` wrong answers. Pure, so the schedule is testable. */
export function delayAfter(failures: number, policy: DelayPolicy): number {
  const over = failures - policy.freeAttempts;
  if (over < 0) return 0;
  return Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** Math.min(over, 20));
}

// ---------------------------------------------------------------------------------------------
// Memory store (per instance; used when Redis is not configured). Synchronous, so atomic.
// ---------------------------------------------------------------------------------------------
interface MemoryEntry {
  failures: number;
  lastAt: number;
  expiresAt: number;
}
const memory = new Map<string, MemoryEntry>();
const MAX_KEYS = 10_000;

export const resetAttemptMemory = (): void => memory.clear();

function memoryBegin(key: string, policy: DelayPolicy, now: number): AttemptStatus {
  const entry = memory.get(key);
  const live = entry && entry.expiresAt > now ? entry : undefined;
  const before = live?.failures ?? 0;
  const wait = live ? delayAfter(before, policy) * 1000 : 0;
  const remaining = live ? live.lastAt + wait - now : 0;
  if (remaining > 0) {
    return { blocked: true, retryAfterSeconds: Math.ceil(remaining / 1000), failures: before };
  }
  memory.delete(key);
  memory.set(key, {
    failures: before + 1,
    lastAt: now,
    expiresAt: now + policy.windowSeconds * 1000,
  });
  if (memory.size > MAX_KEYS) {
    for (const stale of [...memory.keys()].slice(0, memory.size - MAX_KEYS)) memory.delete(stale);
  }
  return { blocked: false, retryAfterSeconds: 0, failures: before };
}

// ---------------------------------------------------------------------------------------------

const redisKey = (name: DelayPolicyName, key: string) => `auren:af:${name}:${key}`;

/**
 * One atomic step on the hash {n, t}: if the previous failures still impose a wait, answer
 * {1, remainingMs}; otherwise count this attempt and answer {0, previousCount}.
 * ARGV: now (ms), free attempts, base delay (s), max delay (s), window (s).
 */
const BEGIN_SCRIPT = `
local n = tonumber(redis.call('HGET', KEYS[1], 'n') or '0')
local t = tonumber(redis.call('HGET', KEYS[1], 't') or '0')
local now = tonumber(ARGV[1])
local free = tonumber(ARGV[2])
local over = n - free
if over >= 0 then
  if over > 20 then over = 20 end
  local delay = math.min(tonumber(ARGV[4]), tonumber(ARGV[3]) * (2 ^ over)) * 1000
  local remaining = t + delay - now
  if remaining > 0 then return {1, remaining, n} end
end
redis.call('HSET', KEYS[1], 'n', n + 1, 't', now)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5]))
return {0, 0, n}
`;

/**
 * Reserves one attempt for `key`. `blocked` means the caller must wait (nothing was counted);
 * otherwise the attempt is counted and the caller may check the credential. Call
 * clearFailures() after a correct answer.
 */
export async function beginAttempt(
  name: DelayPolicyName,
  key: string,
  now: number = Date.now(),
): Promise<AttemptStatus> {
  const policy = DELAY_POLICIES[name];
  const redis = getRedis();
  if (!redis) return memoryBegin(`${name}:${key}`, policy, now);
  try {
    const [blocked, remaining, failures] = await redis.eval<number[], [number, number, number]>(
      BEGIN_SCRIPT,
      [redisKey(name, key)],
      [
        now,
        policy.freeAttempts,
        policy.baseDelaySeconds,
        policy.maxDelaySeconds,
        policy.windowSeconds,
      ],
    );
    return {
      blocked: blocked === 1,
      retryAfterSeconds: blocked === 1 ? Math.max(1, Math.ceil(Number(remaining) / 1000)) : 0,
      failures: Number(failures),
    };
  } catch (error) {
    logger.error({ err: error, policy: name }, 'attempt counter unavailable; failing closed');
    return UNAVAILABLE;
  }
}

/** Forgets the failures for `key` after a correct answer. */
export async function clearFailures(name: DelayPolicyName, key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.delete(`${name}:${key}`);
    return;
  }
  try {
    await redis.del(redisKey(name, key));
  } catch (error) {
    logger.error({ err: error, policy: name }, 'could not clear failed attempts');
  }
}
