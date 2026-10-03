import { z } from 'zod';

export const PRODUCT_PAGE_SIZE = 20;

export const PRODUCT_SORT_LABELS = {
  updated: 'Recently updated',
  title: 'Title',
  status: 'Status',
} as const;

const listSchema = z.object({
  q: z.string().trim().max(80).catch(''),
  status: z.enum(['draft', 'active', 'archived']).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  sort: z.enum(['updated', 'title', 'status']).catch('updated'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ProductListQuery = z.infer<typeof listSchema>;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Reads the list's URL parameters defensively: anything unusable falls back to its default. */
export function parseProductListParams(raw: RawParams): ProductListQuery {
  return listSchema.parse({
    q: first(raw.q) ?? '',
    status: first(raw.status),
    category: first(raw.category),
    sort: first(raw.sort),
    page: first(raw.page),
  });
}

/** The list URL for a set of parameters. Defaults are left out so addresses stay short. */
export function productListHref(query: Partial<ProductListQuery>): string {
  const search = new URLSearchParams();
  if (query.q) search.set('q', query.q);
  if (query.status) search.set('status', query.status);
  if (query.category) search.set('category', query.category);
  if (query.sort && query.sort !== 'updated') search.set('sort', query.sort);
  if (query.page && query.page > 1) search.set('page', String(query.page));
  const text = search.toString();
  return text ? `/admin/products?${text}` : '/admin/products';
}
