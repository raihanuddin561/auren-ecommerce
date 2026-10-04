import { productTag, TAG_PRODUCTS } from '@/modules/catalog/tags';

/** Cache tag vocabulary for stock (ARCHITECTURE section 3.3). Every stock write must revalidate these. */
export const stockTag = (variantId: string) => `stock:${variantId}`;
export const TAG_STOCK = 'stock';

/** Tags a stock change touches: the variants, their products (cards and pages) and the group tag. */
export function stockTagsFor(
  variantIds: readonly string[],
  productIds: readonly string[],
): string[] {
  const tags = new Set<string>(variantIds.length > 0 ? [TAG_STOCK] : []);
  for (const id of variantIds) tags.add(stockTag(id));
  for (const id of productIds) tags.add(productTag(id));
  if (productIds.length > 0) tags.add(TAG_PRODUCTS);
  return [...tags];
}
