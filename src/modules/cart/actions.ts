'use server';

import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { addToCartSchema, type AddToCartResult } from './schemas';
import * as cart from './service';

/**
 * Adds a variant to the bag. This is the single entry point for every "add to bag" button (product
 * card quick-add, product page, later the cart drawer).
 *
 * INTEGRATION POINT (cart stage): today it validates the input, re-checks live stock through the
 * inventory service and answers `{ persisted: false }`; nothing is saved. When the cart exists,
 * only `cart/service.ts addLine` changes; the contract below stays the same:
 *   input  { variantId: uuid, quantity: 1..10 }
 *   result ActionResult<{ variantId, quantity, persisted }>; failures use VALIDATION,
 *          RATE_LIMITED or OUT_OF_STOCK.
 */
export async function addToCart(input: unknown): Promise<ActionResult<AddToCartResult>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { ip } = await getRequestMeta();
    const limited = await rateLimit('addToBag', ip);
    if (!limited.success) return fail('RATE_LIMITED');
    return ok(await cart.addLine(parsed.data));
  } catch (error) {
    return toActionError(error);
  }
}
