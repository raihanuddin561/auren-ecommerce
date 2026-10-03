import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { ProductFilters } from '@/components/admin/catalog/products/product-filters';
import { ProductTable } from '@/components/admin/catalog/products/product-table';
import {
  PRODUCT_PAGE_SIZE,
  parseProductListParams,
  productListHref,
} from '@/components/admin/catalog/products/list-params';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryOptions, listProductsForAdmin } from '@/modules/catalog/queries';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  const staff = await requireStaffWith('catalog.read');
  const query = parseProductListParams(await searchParams);
  const canWrite = hasPermission(staff, 'catalog.write');

  let loaded: Awaited<ReturnType<typeof listProductsForAdmin>> | null = null;
  let categories: Awaited<ReturnType<typeof listCategoryOptions>> = [];
  try {
    [loaded, categories] = await Promise.all([
      listProductsForAdmin({
        q: query.q || undefined,
        status: query.status,
        categoryId: query.category,
        page: query.page,
        pageSize: PRODUCT_PAGE_SIZE,
        sort: query.sort,
      }),
      listCategoryOptions(),
    ]);
  } catch {
    loaded = null;
  }

  const filtered = Boolean(query.q || query.status || query.category);
  const totalPages = loaded ? Math.max(1, Math.ceil(loaded.total / PRODUCT_PAGE_SIZE)) : 1;
  const newProduct = canWrite ? (
    <Button asChild>
      <Link href="/admin/products/new">New product</Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Products"
        description="Titles, variants, prices and images. A product goes live only when it is active."
        actions={newProduct}
      />
      <div className="flex flex-col gap-6">
        <ProductFilters
          query={query}
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        />
        {loaded === null ? (
          <EmptyState
            tone="error"
            title="Products could not be loaded"
            description="Nothing was changed. Try again in a moment."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={productListHref(query)}>Try again</Link>
              </Button>
            }
          />
        ) : loaded.items.length === 0 ? (
          loaded.total > 0 ? (
            <EmptyState
              title="That page is past the end"
              description="There are fewer products than this page expects."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href={productListHref({ ...query, page: 1 })}>Go to the first page</Link>
                </Button>
              }
            />
          ) : filtered ? (
            <EmptyState
              title="No products match"
              description="Try a different search or clear the filters."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/admin/products">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No products yet"
              description={
                canWrite
                  ? 'Create the first product. It starts as a draft and stays hidden until you publish it.'
                  : 'Products will appear here once the catalogue team adds them.'
              }
              action={newProduct}
            />
          )
        ) : (
          <>
            <p role="status" className="type-small text-fg-muted">
              {loaded.total} {loaded.total === 1 ? 'product' : 'products'}
              {totalPages > 1 ? `, page ${query.page} of ${totalPages}` : ''}
            </p>
            <ProductTable rows={loaded.items} />
            <Pagination
              page={query.page}
              totalPages={totalPages}
              hrefFor={(page) => productListHref({ ...query, page })}
            />
          </>
        )}
      </div>
    </>
  );
}
