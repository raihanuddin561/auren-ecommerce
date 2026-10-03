/** URL slugs: lowercase letters, digits and single hyphens. Pure helpers shared by forms and services. */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

/** "Oxford Shirt, Sky Blue!" -> "oxford-shirt-sky-blue". Accents are folded; anything else is dropped. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug;
}

export const isValidSlug = (slug: string): boolean =>
  slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);

/** First free slug: base, base-2, base-3 ... `taken` answers whether a candidate is already used. */
export async function uniqueSlug(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? root : `${root.slice(0, SLUG_MAX_LENGTH - 4)}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new Error('could not find a free slug');
}

/** Storefront paths that a slug change must redirect from (see redirects table). */
export const productPath = (slug: string): string => `/products/${slug}`;
export const collectionPath = (slug: string): string => `/collections/${slug}`;
export const categoryPath = (path: string): string => `/shop/${path}`;
