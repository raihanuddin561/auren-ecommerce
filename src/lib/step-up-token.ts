import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A step-up token proves that this session re-entered its password or TOTP recently, for one
 * purpose (for example `orders.refund`). It is bound to the session, the user and the purpose, so
 * it cannot be moved to another session or used for a different action, and it expires quickly.
 * Format: `<sessionId>:<userId>:<purpose>:<issuedAtSeconds>:<signature>`; the signature is HMAC-SHA256 over
 * the first three parts with a key derived from the auth secret for this purpose only.
 */
export interface StepUpClaims {
  sessionId: string;
  userId: string;
  purpose: string;
  issuedAt: number;
}

export const PURPOSE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const keyFor = (secret: string) => createHmac('sha256', secret).update('auren.step-up.v1').digest();

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', keyFor(secret)).update(payload).digest('base64url');

export function signStepUp(secret: string, claims: StepUpClaims): string {
  const payload = `${claims.sessionId}:${claims.userId}:${claims.purpose}:${claims.issuedAt}`;
  return `${payload}:${sign(secret, payload)}`;
}

export function verifyStepUp(
  secret: string,
  token: string | undefined,
  expected: {
    sessionId: string;
    userId: string;
    purpose: string;
    nowSeconds: number;
    windowSeconds: number;
  },
): boolean {
  if (!token || token.length > 400) return false;
  const parts = token.split(':');
  if (parts.length !== 5) return false;
  const [sessionId, userId, purpose, issuedRaw, signature] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const payload = `${sessionId}:${userId}:${purpose}:${issuedRaw}`;
  const given = Buffer.from(signature);
  const wanted = Buffer.from(sign(secret, payload));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return false;
  if (sessionId !== expected.sessionId || userId !== expected.userId) return false;
  if (purpose !== expected.purpose) return false;
  const issuedAt = Number(issuedRaw);
  if (!Number.isInteger(issuedAt)) return false;
  const age = expected.nowSeconds - issuedAt;
  // A token from the future is as suspicious as an old one.
  return age >= 0 && age <= expected.windowSeconds;
}
