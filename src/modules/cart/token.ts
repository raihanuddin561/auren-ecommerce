import { createHash, randomBytes } from 'node:crypto';

/** The bag cookie: an opaque random token. Only its SHA-256 is stored, so a database leak is no key. */
export const CART_COOKIE = 'auren_cart';
export const CART_TTL_DAYS = 30;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const newCartToken = (): string => randomBytes(32).toString('base64url');

/** True for a well-formed token. Anything else in the cookie is treated as "no cart". */
export const isCartToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

export const hashCartToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
