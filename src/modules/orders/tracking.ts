import { createHash, timingSafeEqual } from 'node:crypto';
import { hmac, hmacHex } from '@/lib/order-secret';
import { normalizeBdPhone } from '@/lib/phone';

/**
 * Guest order access (INV-O10).
 *
 * The tracking token is 128 bits that cannot be guessed: HMAC-SHA256 of the order id under a server
 * secret, cut to 16 bytes. Deriving it (instead of storing it) means the database, the idempotency
 * records and the outbox never hold a usable link; only its SHA-256 hash is stored, and the email
 * handler can rebuild the link from the order id. A token alone opens the order only together with
 * a second factor: the phone or email on the order, or the signed proof the browser that placed the
 * order receives. An order number is never a credential: with a matching phone or email it shows
 * the status and nothing else.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const deriveTrackingToken = (orderId: string): string =>
  hmac('order-tracking:v1', orderId).subarray(0, 16).toString('base64url');

export const isTrackingToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

export const hashTrackingToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Constant-time comparison of two strings of any length. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * The second factor a customer types: a Bangladesh phone number or an email address. Returns the
 * comparable form, or null when it is neither.
 */
export function normalizeFactor(input: string): { kind: 'phone' | 'email'; value: string } | null {
  const text = input.trim();
  if (text.includes('@')) {
    return text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
      ? { kind: 'email', value: text.toLowerCase() }
      : null;
  }
  const phone = normalizeBdPhone(text);
  return phone ? { kind: 'phone', value: phone } : null;
}

export function factorMatches(
  factor: { kind: 'phone' | 'email'; value: string },
  order: { phone: string; email: string | null },
): boolean {
  if (factor.kind === 'phone') return safeEqual(factor.value, order.phone);
  return order.email !== null && safeEqual(factor.value, order.email.toLowerCase());
}

// ---------------------------------------------------------------------------------------------
// Proof cookie: "this browser already showed the second factor for this order"
// ---------------------------------------------------------------------------------------------

export const PROOF_COOKIE = 'auren_order_proof';
export const PROOF_TTL_SECONDS = 24 * 3600;

const proofSignature = (orderId: string, expires: number): string =>
  hmacHex('order-proof:v1', `${orderId}.${expires}`);

export function signOrderProof(orderId: string, now: Date = new Date()): string {
  const expires = Math.floor(now.getTime() / 1000) + PROOF_TTL_SECONDS;
  return `${orderId}.${expires}.${proofSignature(orderId, expires)}`;
}

/** True when the cookie value is a fresh proof made by this server for exactly this order. */
export function verifyOrderProof(
  value: string | undefined,
  orderId: string,
  now: Date = new Date(),
): boolean {
  if (!value) return false;
  const [id, expiresText, signature, ...rest] = value.split('.');
  if (rest.length > 0 || !id || !expiresText || !signature) return false;
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires * 1000 < now.getTime()) return false;
  if (!safeEqual(id, orderId)) return false;
  return safeEqual(signature, proofSignature(orderId, expires));
}
