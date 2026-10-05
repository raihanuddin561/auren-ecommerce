import { readCartIdentity } from '@/modules/cart/cookie';
import { summarize, type CheckoutSummary } from './service';

/**
 * The checkout page's starting point: the bag and the payment methods, before an address is known.
 * Reads the bag cookie, so it keeps the page dynamic (render it inside Suspense).
 */
export async function getCheckoutSummary(): Promise<CheckoutSummary> {
  return summarize(await readCartIdentity(), null);
}
