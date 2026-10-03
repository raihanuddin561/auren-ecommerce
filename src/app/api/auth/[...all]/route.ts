import { toNextJsHandler } from 'better-auth/next-js';
import { beginAttempt, clearFailures } from '@/lib/attempts';
import { auth } from '@/lib/auth';
import {
  hashIdentifier,
  limiterForAuthRequest,
  rateLimit,
  tooManyRequests,
} from '@/lib/rate-limit';
import { MAX_BODY_BYTES, readCappedBody } from '@/lib/request-body';
import { requestIp } from '@/lib/request-meta';
import { TURNSTILE_HEADER, turnstileEnabled, verifyTurnstile } from '@/lib/turnstile';

const handlers = toNextJsHandler(auth);

const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

/** The email being signed in, from the very body Better Auth will read. Null if there is none. */
function signInEmail(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { email?: unknown };
    const email = parsed.email;
    return typeof email === 'string' && email.length > 0 && email.length <= 320 ? email : null;
  } catch {
    return null;
  }
}

/**
 * Every auth call is protected before Better Auth sees it (INV-A4):
 *  - the body is size-capped while it is read, and re-sent to Better Auth as the same bytes;
 *  - counted per client address (credential limiters refuse when Redis is down);
 *  - sign-in must be JSON with an email (no request shape escapes the account delay), needs a
 *    Turnstile token when Turnstile is configured, and each attempt is reserved atomically per
 *    ACCOUNT: after a few wrong passwords the account must wait, from any address. A correct
 *    password clears the counter, so legitimate users are never slowed down.
 * The same refusals apply whether or not the account exists, so they reveal nothing about it.
 */
function withProtection(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const limiter = limiterForAuthRequest(request.method, new URL(request.url).pathname);
    const ip = requestIp(request.headers);

    const byAddress = await rateLimit(limiter, ip);
    if (!byAddress.success) return tooManyRequests(byAddress);

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    let forwarded = request;
    let body = '';
    if (hasBody) {
      const text = await readCappedBody(request, MAX_BODY_BYTES);
      if (text === null) return json(413, 'PAYLOAD_TOO_LARGE', 'That request is too large.');
      body = text;
      // The body is forwarded as the text we read, so the original length header no longer applies.
      const headers = new Headers(request.headers);
      headers.delete('content-length');
      forwarded = new Request(request.url, { method: request.method, headers, body: text });
    }
    if (limiter !== 'login') return handler(forwarded);

    if (turnstileEnabled() && !(await verifyTurnstile(request.headers.get(TURNSTILE_HEADER), ip))) {
      return json(400, 'BOT_CHECK_FAILED', 'Please complete the check and try again.');
    }

    const email = request.headers.get('content-type')?.includes('application/json')
      ? signInEmail(body)
      : null;
    if (!email) return json(400, 'INVALID_REQUEST', 'Enter your email and password.');
    const account = hashIdentifier(email);

    const attempt = await beginAttempt('login', account);
    if (attempt.blocked) {
      return tooManyRequests({
        success: false,
        limit: 0,
        remaining: 0,
        retryAfterSeconds: Math.max(1, attempt.retryAfterSeconds),
      });
    }

    const response = await handler(forwarded);
    // The attempt is already counted. Anything that proves the password was right (2xx, or the
    // 403 Better Auth returns for an unverified address only after the password matched) clears it.
    if (response.status < 400 || response.status === 403) await clearFailures('login', account);
    return response;
  };
}

export const GET = withProtection(handlers.GET);
export const POST = withProtection(handlers.POST);
