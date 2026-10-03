import 'server-only';
import { env } from './env';
import { logger } from './logger';

/**
 * Cloudflare Turnstile (bot check) for sign-in. Optional: when TURNSTILE_SECRET_KEY is not set
 * nothing changes. When it is set, a request without a valid token is refused, and so is a request
 * for which Cloudflare cannot be reached (fail closed).
 */
export const TURNSTILE_HEADER = 'x-turnstile-token';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 3_000;
const MAX_TOKEN_LENGTH = 2048;

export const turnstileEnabled = (): boolean => Boolean(env.TURNSTILE_SECRET_KEY);

export async function verifyTurnstile(
  token: string | null,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    // The address is a hint for Cloudflare's risk score; it is never a reason to accept a token.
    if (ip && !ip.includes('/')) body.set('remoteip', ip);
    const response = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown; hostname?: unknown };
    if (result.success !== true) return false;
    // A token minted for another site with the same widget must not unlock this one.
    const expected = new URL(env.APP_URL).hostname;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(expected);
    return local || result.hostname === undefined || result.hostname === expected;
  } catch (error) {
    logger.error({ err: error }, 'turnstile verification unavailable; refusing the request');
    return false;
  }
}
