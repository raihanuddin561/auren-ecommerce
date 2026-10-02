import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import {
  hashIdentifier,
  limiterForAuthRequest,
  rateLimit,
  tooManyRequests,
  type RateLimitResult,
} from '@/lib/rate-limit';
import { requestIp } from '@/lib/request-meta';

const handlers = toNextJsHandler(auth);
const MAX_BODY_BYTES = 8 * 1024;

/** The email being signed in, read from a copy of the body, for the per-account limit. */
async function signInEmail(request: Request): Promise<string | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return null;
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === 'string' && body.email.length <= 320 ? body.email : null;
  } catch {
    return null;
  }
}

/**
 * Every auth call is counted before Better Auth sees it (INV-A4): per client address, and for
 * sign-in also per account so guessing from many addresses is limited too.
 */
function withRateLimit(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const limiter = limiterForAuthRequest(request.method, new URL(request.url).pathname);
    const checks: Promise<RateLimitResult>[] = [rateLimit(limiter, requestIp(request.headers))];
    if (limiter === 'login') {
      const email = await signInEmail(request);
      if (email) checks.push(rateLimit('loginAccount', hashIdentifier(email)));
    }
    const blocked = (await Promise.all(checks)).find((result) => !result.success);
    if (blocked) return tooManyRequests(blocked);
    return handler(request);
  };
}

export const GET = withRateLimit(handlers.GET);
export const POST = withRateLimit(handlers.POST);
