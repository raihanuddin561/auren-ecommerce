import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { PROOF_COOKIE, PROOF_TTL_SECONDS, signOrderProof } from './tracking';

/** The signed proof that this browser showed the second factor (or placed the order). */
export async function readOrderProof(): Promise<string | undefined> {
  return (await cookies()).get(PROOF_COOKIE)?.value;
}

/** HttpOnly, scoped to the tracking pages, a day long. */
export async function writeOrderProof(orderId: string): Promise<void> {
  (await cookies()).set(PROOF_COOKIE, signOrderProof(orderId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_URL.startsWith('https://'),
    path: '/track',
    maxAge: PROOF_TTL_SECONDS,
  });
}
