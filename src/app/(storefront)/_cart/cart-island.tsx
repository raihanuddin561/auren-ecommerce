import { unstable_rethrow } from 'next/navigation';
import { CartHydrator } from '@/components/storefront/cart/cart-hydrator';
import { logger } from '@/lib/logger';
import { getCartView } from '@/modules/cart/queries';
import type { CartView } from '@/modules/cart/view';

async function readBag(): Promise<CartView | null> {
  try {
    return await getCartView();
  } catch (error) {
    // Next.js uses thrown signals to mark a page dynamic: they must never be swallowed here.
    unstable_rethrow(error);
    logger.error({ err: error }, 'bag could not be loaded');
    return null;
  }
}

/**
 * The dynamic island of the storefront shell: reads the bag cookie on the server and gives the
 * browser store the current bag. It sits inside Suspense so the rest of the page stays static.
 * A failure here must never break a page: the bag simply shows as empty until the next action.
 */
export async function CartIsland() {
  const view = await readBag();
  return view ? <CartHydrator view={view} /> : null;
}
