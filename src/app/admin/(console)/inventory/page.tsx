import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { parseStockParams, stockListHref } from '@/components/admin/inventory/list-params';
import { StockFilters } from '@/components/admin/inventory/stock-filters';
import { StockTable } from '@/components/admin/inventory/stock-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryOptions } from '@/modules/catalog/queries';
import { listStockLevels } from '@/modules/inventory/queries';

export const metadata: Metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: PageProps<'/admin/inventory'>) {
  const staff = await requireStaffWith('inventory.read');
  const query = parseStockParams(await searchParams);
  const canAdjust = hasPermission(staff, 'inventory.adjust');
  // Cost of goods is shown only to staff who buy stock or read finance.
  const canSeeCost =
    hasPermission(staff, 'purchasing.manage') || hasPermission(staff, 'finance.read');

  let loaded: Awaited<ReturnType<typeof listStockLevels>> | null = null;
  let categories: Awaited<ReturnType<typeof listCategoryOptions>> = [];
  try {
    [loaded, categories] = await Promise.all([
      listStockLevels({
        ...(query.q ? { q: query.q } : {}),
        status: query.status,
        ...(query.category ? { categoryId: query.category } : {}),
        page: query.page,
      }),
      listCategoryOptions(),
    ]);
  } catch (error) {
    // Next.js control flow (redirects, dynamic rendering signals) must pass through untouched.
    unstable_rethrow(error);
    loaded = null;
  }

  const filtered = Boolean(query.q || query.category || query.status !== 'all');
  const totalPages = loaded ? Math.max(1, Math.ceil(loaded.total / loaded.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Units on hand, reserved for customers and available to sell, per variant. Stock arrives through purchase orders; use Adjust for counts, damage and finds."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/inventory/movements">Movement ledger</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/purchasing">Purchase orders</Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <StockFilters
          key={stockListHref(query)}
          query={query}
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        />
        {loaded === null ? (
          <EmptyState
            tone="error"
            title="Stock levels could not be loaded"
            description="Nothing was changed. Try again in a moment."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={stockListHref(query)}>Try again</Link>
              </Button>
            }
          />
        ) : loaded.rows.length === 0 ? (
          <EmptyState
            title={filtered ? 'No variants match' : 'No variants yet'}
            description={
              filtered
                ? 'Try a different search or clear the filters.'
                : 'Create a product with variants first. New variants start with zero stock.'
            }
            action={
              filtered ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/admin/inventory">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p role="status" className="type-small text-fg-muted">
              {loaded.total} {loaded.total === 1 ? 'variant' : 'variants'}
              {totalPages > 1 ? `, page ${query.page} of ${totalPages}` : ''}
            </p>
            <StockTable
              rows={loaded.rows.map((row) => (canSeeCost ? row : { ...row, avgCost: null }))}
              canAdjust={canAdjust}
              showCost={canSeeCost}
            />
            <Pagination
              page={query.page}
              totalPages={totalPages}
              hrefFor={(page) => stockListHref({ ...query, page })}
            />
          </>
        )}
      </div>
    </>
  );
}
