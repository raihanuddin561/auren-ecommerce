'use server';

import { ok, fail, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { readCartIdentity, writeCartCookie } from './cookie';
import { addToCartSchema, setLineQuantitySchema } from './schemas';
import * as cart from './service';
import type { CartView } from './view';

export interface CartActionData {
  view: CartView;
}

/**
 * The single entry point for every "add to bag" button (product page, card quick-add, the bag
 * itself). The browser sends a variant id and a quantity and nothing else: prices, stock and
 * totals are read on the server and come back in the view (INV-M3, INV-O8).
 */
export async function addToCart(input: unknown): Promise<ActionResult<CartActionData>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const limited = await rateLimit('addToBag', ip);
    if (!limited.success) return fail('RATE_LIMITED');
    const result = await cart.addLine(await readCartIdentity(), parsed.data);
    if (result.newToken) await writeCartCookie(result.newToken);
    return ok({ view: result.view });
  } catch (error) {
    return toActionError(error);
  }
}

/** Sets one line to an exact quantity. Zero removes it; setting it again restores it (undo). */
export async function setCartLine(input: unknown): Promise<ActionResult<CartActionData>> {
  const parsed = setLineQuantitySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    const limited = await rateLimit('addToBag', ip);
    if (!limited.success) return fail('RATE_LIMITED');
    const result = await cart.setLineQuantity(await readCartIdentity(), parsed.data);
    if (result.newToken) await writeCartCookie(result.newToken);
    return ok({ view: result.view });
  } catch (error) {
    return toActionError(error);
  }
}

/** The current bag, fresh from the database (the drawer asks when it opens). */
export async function refreshCart(): Promise<ActionResult<CartActionData>> {
  try {
    return ok({ view: await cart.getView(await readCartIdentity()) });
  } catch (error) {
    return toActionError(error);
  }
}
