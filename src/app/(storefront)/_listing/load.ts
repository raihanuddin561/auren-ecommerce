import 'server-only';
import { applyAvailability, variantIdsOf, type ProductCardData } from '@/modules/catalog/card';
import { contentQuery, type ListingQuery } from '@/modules/catalog/listing';
import {
  getListing,
  loadListing,
  type ListingResult,
  type ListingScope,
} from '@/modules/catalog/queries';
import { getInStockProductIds, getVariantAvailability } from '@/modules/inventory/queries';

/**
 * One listing page for a request. Plain and filtered pages come from the cached query (keyed by
 * what changes the products, never by density). The "In stock" filter needs the live stock, so it
 * skips the cache and reads the inventory first.
 */
export async function listingFor(
  scope: ListingScope,
  query: ListingQuery,
): Promise<ListingResult | null> {
  const content = contentQuery(query);
  if (content.inStock) {
    return loadListing(scope, content, await getInStockProductIds());
  }
  return getListing(scope, content);
}

/** Merges live availability into cards: the size row, the Low stock and Sold out badges. */
export async function withLiveStock(cards: ProductCardData[]): Promise<ProductCardData[]> {
  if (cards.length === 0) return cards;
  const availability = await getVariantAvailability(variantIdsOf(cards));
  return cards.map((card) => applyAvailability(card, availability));
}
