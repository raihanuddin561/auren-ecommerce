import 'server-only';
import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { CART_COOKIE, CART_TTL_DAYS, isCartToken } from './token';
import type { CartIdentity } from './types';

/**
 * Who owns the bag in this request: the signed-in customer (never staff-only accounts are special
 * here, any signed-in user may shop) and the bag cookie. Reads cookies, so the caller renders
 * inside Suspense or runs in an action.
 */
export async function readCartIdentity(): Promise<CartIdentity> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  const session = await getSession().catch((error: unknown) => {
    // Dynamic rendering signals pass through; a failed session lookup just means "not signed in".
    unstable_rethrow(error);
    return null;
  });
  return {
    userId: session && !session.user.banned ? session.user.id : null,
    token: isCartToken(raw) ? raw : null,
  };
}

/** Sets the opaque bag cookie: HttpOnly, SameSite=Lax, Secure on https, 30 days. */
export async function writeCartCookie(token: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_URL.startsWith('https://'),
    path: '/',
    maxAge: CART_TTL_DAYS * 24 * 3600,
  });
}
