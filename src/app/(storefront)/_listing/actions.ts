'use server';

import { z } from 'zod';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import type { ProductCardData } from '@/modules/catalog/card';
import { MAX_LISTING_PAGE, parseListingQuery } from '@/modules/catalog/listing';
import { listingFor, withLiveStock } from './load';

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** Strict: unknown keys are refused. `search` is the page's query string without the page number. */
const loadMoreSchema = z
  .object({
    scope: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('shop'),
          path: z
            .string()
            .max(260)
            .regex(/^([a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*){0,2})?$/),
        })
        .strict(),
      z.object({ kind: z.literal('collection'), slug }).strict(),
    ]),
    search: z.string().max(600),
    page: z.number().int().min(2).max(MAX_LISTING_PAGE),
  })
  .strict();

export interface LoadMoreResult {
  cards: ProductCardData[];
  hasMore: boolean;
}

/**
 * The next page of a shop or collection listing, for "Load more". Same rules as the page itself
 * (the query string is parsed with the same schema), live stock merged in, rate limited per address.
 */
export async function loadMoreProducts(input: unknown): Promise<ActionResult<LoadMoreResult>> {
  const parsed = loadMoreSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { ip } = await getRequestMeta();
    if (!(await rateLimit('listingMore', ip)).success) return fail('RATE_LIMITED');

    const params = new URLSearchParams(parsed.data.search);
    const raw: Record<string, string[]> = {};
    for (const key of new Set(params.keys())) raw[key] = params.getAll(key);
    const query = { ...parseListingQuery(raw), page: parsed.data.page };

    const result = await listingFor(parsed.data.scope, query);
    if (!result) return fail('NOT_FOUND');
    return ok({
      cards: await withLiveStock(result.cards),
      hasMore: query.page < result.totalPages,
    });
  } catch (error) {
    return toActionError(error);
  }
}
