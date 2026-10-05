'use server';

import { z } from 'zod';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import type { ProductCardData } from '@/modules/catalog/card';
import { getProductCardsByIds } from '@/modules/catalog/queries';
import { withLiveStock } from '../_listing/load';

const loadWishlistSchema = z.object({ ids: z.array(z.uuid()).max(60) }).strict();

/** Cards for the product ids kept in this browser's wishlist, with live stock. Public, read-only. */
export async function loadWishlistCards(input: unknown): Promise<ActionResult<ProductCardData[]>> {
  const parsed = loadWishlistSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { ip } = await getRequestMeta();
    if (!(await rateLimit('listingMore', ip)).success) return fail('RATE_LIMITED');
    return ok(await withLiveStock(await getProductCardsByIds(parsed.data.ids)));
  } catch (error) {
    return toActionError(error);
  }
}
