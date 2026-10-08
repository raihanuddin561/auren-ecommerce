import { stockListSchema, type StockListParams } from '@/modules/inventory/schemas';

export type StockStatusFilter = StockListParams['status'];

export const STOCK_STATUS_LABELS: Record<StockStatusFilter, string> = {
  all: 'All stock levels',
  in_stock: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
  no_cost: 'No cost: cannot be ordered',
};

export interface StockQuery {
  q: string;
  status: StockStatusFilter;
  category?: string | undefined;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the URL; anything invalid falls back to the default view instead of failing. */
export function parseStockParams(raw: RawParams): StockQuery {
  const parsed = stockListSchema.safeParse({
    ...(first(raw.q) ? { q: first(raw.q) } : {}),
    ...(first(raw.status) ? { status: first(raw.status) } : {}),
    ...(first(raw.category) ? { categoryId: first(raw.category) } : {}),
    ...(first(raw.page) ? { page: first(raw.page) } : {}),
  });
  if (!parsed.success) return { q: '', status: 'all', page: 1 };
  return {
    q: parsed.data.q ?? '',
    status: parsed.data.status,
    category: parsed.data.categoryId,
    page: parsed.data.page,
  };
}

export function stockListHref(query: StockQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status !== 'all') params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.page > 1) params.set('page', String(query.page));
  const text = params.toString();
  return text ? `/admin/inventory?${text}` : '/admin/inventory';
}
