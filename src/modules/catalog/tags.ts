/** Cache tag vocabulary (ARCHITECTURE section 3.3). Build tags with these so spelling never drifts. */
export const productTag = (id: string) => `product:${id}`;
export const collectionTag = (id: string) => `collection:${id}`;
export const categoryTag = (id: string) => `category:${id}`;
export const TAG_PRODUCTS = 'products';
export const TAG_COLLECTIONS = 'collections';
export const TAG_CATEGORIES = 'categories';
export const TAG_SITEMAP = 'sitemap';
export const TAG_FEEDS = 'feeds';

export interface TagScope {
  products?: readonly string[];
  collections?: readonly string[];
  categories?: readonly string[];
}

/** Every tag a catalogue write must invalidate. Publishing-relevant writes always include the sitemap. */
export function catalogTags(scope: TagScope): string[] {
  const tags = new Set<string>([TAG_SITEMAP, TAG_FEEDS]);
  for (const id of scope.products ?? []) {
    tags.add(productTag(id));
    tags.add(TAG_PRODUCTS);
  }
  for (const id of scope.collections ?? []) {
    tags.add(collectionTag(id));
    tags.add(TAG_COLLECTIONS);
  }
  for (const id of scope.categories ?? []) {
    tags.add(categoryTag(id));
    tags.add(TAG_CATEGORIES);
  }
  return [...tags];
}
