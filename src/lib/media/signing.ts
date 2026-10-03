import { createHmac, timingSafeEqual } from 'node:crypto';

export const PRIVATE_MEDIA_PATH = '/api/media-private';
const MAX_TTL_SECONDS = 3600;

const mac = (key: string, expires: number, secret: string): string =>
  createHmac('sha256', `auren:private-media:${secret}`)
    .update(`${expires}:${key}`)
    .digest('base64url');

/** A link that works for `ttlSeconds` (at most one hour) and only for this key. */
export function signMediaUrl(
  appUrl: string,
  key: string,
  secret: string,
  ttlSeconds: number,
  now = Date.now(),
): string {
  const ttl = Math.min(Math.max(Math.floor(ttlSeconds), 1), MAX_TTL_SECONDS);
  const expires = Math.floor(now / 1000) + ttl;
  const url = new URL(`${PRIVATE_MEDIA_PATH}/${key}`, appUrl);
  url.searchParams.set('exp', String(expires));
  url.searchParams.set('sig', mac(key, expires, secret));
  return url.toString();
}

export function verifyMediaSignature(
  key: string,
  expires: string | null,
  signature: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!expires || !signature || !/^\d{1,12}$/.test(expires)) return false;
  const exp = Number(expires);
  const nowSeconds = Math.floor(now / 1000);
  if (exp < nowSeconds || exp > nowSeconds + MAX_TTL_SECONDS) return false;
  const expected = Buffer.from(mac(key, exp, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
