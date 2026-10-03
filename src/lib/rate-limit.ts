import 'server-only';
import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { logger } from './logger';
import { getRedis } from './redis';

/** Limits from ARCHITECTURE section 11. Window in seconds. */
export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 60 },
  register: { limit: 5, windowSeconds: 300 },
  passwordReset: { limit: 3, windowSeconds: 300 },
  verificationEmail: { limit: 3, windowSeconds: 300 },
  twoFactor: { limit: 5, windowSeconds: 60 },
  otp: { limit: 3, windowSeconds: 300 },
  checkoutSubmit: { limit: 10, windowSeconds: 600 },
  couponApply: { limit: 10, windowSeconds: 300 },
  reviewSubmit: { limit: 5, windowSeconds: 3600 },
  /** Any other state-changing auth call (change password, sign out, delete account...). */
  authMutation: { limit: 10, windowSeconds: 60 },
  /** Read-only auth calls such as get-session. */
  authGeneral: { limit: 120, windowSeconds: 60 },
} as const;

export type LimiterName = keyof typeof RATE_LIMITS;

/**
 * Limiters that protect credentials and account recovery. When Redis is configured but cannot be
 * reached they REFUSE the request instead of falling back to a per-instance counter, so an outage
 * cannot be used to guess passwords or flood reset emails. Read-only and commerce limiters
 * degrade to memory (INV-A4) because blocking them would take the site down with Redis.
 */
export const FAIL_CLOSED: ReadonlySet<LimiterName> = new Set<LimiterName>([
  'login',
  'register',
  'passwordReset',
  'verificationEmail',
  'twoFactor',
  'otp',
  'authMutation',
]);

/** How long a caller is told to wait when a fail-closed limiter cannot be consulted. */
export const UNAVAILABLE_RETRY_SECONDS = 30;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Seconds until a blocked caller may try again. */
  retryAfterSeconds: number;
}

/**
 * Callers whose address cannot be determined (no trusted proxy header, or a chain shorter than the
 * configured hop count) all share ONE bucket with this fraction of the normal limit. Anyone who
 * dodges the proxy therefore gets less room than a located caller, not more.
 */
export const UNKNOWN_ADDRESS_FACTOR = 0.5;

const scaled = (limit: number, factor: number) => Math.max(1, Math.ceil(limit * factor));

// ---------------------------------------------------------------------------------------------
// In-memory fallback (sliding window log). Per server instance: fine for local work, tests and as
// the safety net when Redis is slow or down; production relies on Upstash for a shared view.
// ---------------------------------------------------------------------------------------------

const memory = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function memoryLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now(),
): RateLimitResult {
  const windowMs = windowSeconds * 1000;
  const hits = (memory.get(key) ?? []).filter((at) => now - at < windowMs);
  let result: RateLimitResult;
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    result = {
      success: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  } else {
    hits.push(now);
    result = { success: true, limit, remaining: limit - hits.length, retryAfterSeconds: 0 };
  }
  // Re-insert so the Map stays ordered by recency of use (least recently used first).
  memory.delete(key);
  memory.set(key, hits);
  if (memory.size > MAX_KEYS) {
    for (const stale of [...memory.keys()].slice(0, memory.size - MAX_KEYS)) memory.delete(stale);
  }
  return result;
}

export const resetMemoryLimits = (): void => memory.clear();

// ---------------------------------------------------------------------------------------------

const UPSTASH_TIMEOUT_MS = 1_500;
const upstashLimiters = new Map<LimiterName, Ratelimit>();

function upstashFor(name: LimiterName, factor: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${name}:${factor}` as LimiterName;
  let limiter = upstashLimiters.get(cacheKey);
  if (!limiter) {
    const { limit, windowSeconds } = RATE_LIMITS[name];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(scaled(limit, factor), `${windowSeconds} s`),
      prefix: `auren:rl:${name}`,
      analytics: false,
      timeout: UPSTASH_TIMEOUT_MS,
    });
    upstashLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

/** Hash identifiers that are personal data (emails) before they become Redis keys. */
export const hashIdentifier = (value: string): string =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32);

/**
 * Counts one attempt for `identifier` (an IP address, a hashed email, or a user id once signed in)
 * against the named limit. Pass null when the address is unknown. Uses Upstash Redis when
 * configured, otherwise memory. If Redis errors or times out, credential limiters (FAIL_CLOSED)
 * refuse the request; the others fall back to memory, so a Redis outage degrades to per-instance
 * limiting instead of taking the storefront down (INV-A4).
 */
export async function rateLimit(
  name: LimiterName,
  identifier: string | null,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  const factor = identifier === null ? UNKNOWN_ADDRESS_FACTOR : 1;
  const id = identifier ?? 'no-address';

  const upstash = upstashFor(name, factor);
  if (upstash) {
    try {
      const result = await upstash.limit(id);
      // The client resolves `success: true` with reason "timeout" when Redis is too slow.
      if (result.reason !== 'timeout') {
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          retryAfterSeconds: result.success
            ? 0
            : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        };
      }
      logger.warn({ limiter: name }, 'rate limiter timed out');
    } catch (error) {
      logger.error({ err: error, limiter: name }, 'rate limiter unavailable');
    }
    if (FAIL_CLOSED.has(name)) {
      return {
        success: false,
        limit: scaled(limit, factor),
        remaining: 0,
        retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS,
      };
    }
  }
  return memoryLimit(`${name}:${id}`, scaled(limit, factor), windowSeconds);
}

/**
 * Maps a Better Auth request to the limiter that protects it. Safe by default: every request that
 * changes state and is not listed uses the stricter `authMutation` bucket; only reads share the
 * generous general bucket.
 */
export function limiterForAuthRequest(method: string, pathname: string): LimiterName {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'authGeneral';
  if (pathname.endsWith('/sign-in/email')) return 'login';
  if (pathname.endsWith('/sign-up/email')) return 'register';
  if (pathname.endsWith('/request-password-reset') || pathname.endsWith('/reset-password')) {
    return 'passwordReset';
  }
  if (pathname.endsWith('/send-verification-email')) return 'verificationEmail';
  if (pathname.includes('/two-factor')) return 'twoFactor';
  if (pathname.includes('phone-number') || pathname.includes('email-otp')) return 'otp';
  return 'authMutation';
}

export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment.' } },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': '0',
        'Cache-Control': 'no-store',
      },
    },
  );
}
