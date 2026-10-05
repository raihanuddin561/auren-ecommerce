import { logger } from '@/lib/logger';
import { inngest } from '@/lib/jobs/client';
import { readCartIdentity } from './cookie';
import * as cart from './service';
import type { CartView } from './view';

/**
 * The visitor's bag for a Server Component. Reads the bag cookie, so it keeps the page dynamic:
 * render it inside Suspense (the header's bag count and the bag page do).
 */
export async function getCartView(): Promise<CartView> {
  return cart.getView(await readCartIdentity());
}

/** Cron: removes bags nobody has touched for 30 days. Never touches orders. */
export const purgeExpiredCarts = inngest.createFunction(
  { id: 'purge-expired-carts', triggers: [{ cron: '41 3 * * *' }] },
  async () => {
    const removed = await cart.purgeExpired();
    if (removed > 0) logger.info({ removed }, 'expired bags removed');
    return { removed };
  },
);

export const cartFunctions = [purgeExpiredCarts];
