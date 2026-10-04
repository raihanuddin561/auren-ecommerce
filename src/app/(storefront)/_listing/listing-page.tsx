import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  ActiveFilters,
  ListingEmpty,
  ListingHeader,
} from '@/components/storefront/catalog/listing-parts';
import { ListingControls } from '@/components/storefront/catalog/listing-controls';
import { LoadMore } from '@/components/storefront/catalog/load-more';
import { ProductGrid } from '@/components/storefront/catalog/product-grid';
import { Pagination } from '@/components/ui/pagination';
import { collectionPage } from '@/lib/seo/jsonld';
import type { ProductCardData } from '@/modules/catalog/card';
import {
  EMPTY_QUERY,
  gridImageSizes,
  hasFilters,
  listingHref,
  listingSearch,
  listingSeo,
  pageLinks,
  parseListingQuery,
  type ListingQuery,
  type RawSearchParams,
} from '@/modules/catalog/listing';
import type { ListingResult, ListingScope } from '@/modules/catalog/queries';
import { loadMoreProducts } from './actions';
import { listingFor, withLiveStock } from './load';

/** Words a title may end with that the layout's own " | AUREN" suffix would double. */
const withoutSuffix = (title: string) => title.replace(/\s*\|\s*AUREN\s*$/i, '').trim();

/** Page title, description and the indexing rules of ARCHITECTURE section 9 for one request. */
export async function listingMetadata(
  scope: ListingScope,
  searchParams: RawSearchParams,
): Promise<Metadata> {
  const query = parseListingQuery(searchParams);
  // Titles do not depend on the stock filter, so metadata never needs the live inventory.
  const result = await listingFor(scope, { ...query, inStock: false });
  if (!result) return { title: 'Page not found', robots: { index: false, follow: false } };

  const { header } = result;
  const seo = listingSeo(header.basePath, query);
  const base = withoutSuffix(header.seoTitle ?? header.title);
  const title = query.page > 1 ? `${base}, page ${query.page}` : base;
  const links = pageLinks(header.basePath, query, result.totalPages);
  return {
    title,
    description: header.seoDescription ?? header.description ?? undefined,
    alternates: { canonical: seo.canonical },
    robots: { index: seo.index, follow: true },
    ...(seo.index ? { pagination: { previous: links.prev, next: links.next } } : {}),
  };
}

interface ListingContentProps {
  scope: ListingScope;
  searchParams: Promise<RawSearchParams>;
}

/** Cards with live stock merged in. Streams in after the cached shell, so the shell never goes stale. */
async function StockGrid({
  result,
  query,
  priorityCount,
}: {
  result: ListingResult;
  query: ListingQuery;
  priorityCount: number;
}) {
  const cards = await withLiveStock(result.cards);
  return (
    <GridWith
      cards={cards}
      query={query}
      priorityCount={priorityCount}
      label={result.header.title}
    />
  );
}

function GridWith({
  cards,
  query,
  priorityCount,
  label,
}: {
  cards: ProductCardData[];
  query: ListingQuery;
  priorityCount: number;
  label: string;
}) {
  return (
    <ProductGrid
      products={cards}
      label={`${label} products`}
      priorityCount={priorityCount}
      density={query.density}
      sizes={gridImageSizes(query.density)}
    />
  );
}

/** Everything below the page's route file: header, bar, grid, pagination, structured data. */
export async function ListingContent({ scope, searchParams }: ListingContentProps) {
  const query = parseListingQuery(await searchParams);
  const result = await listingFor(scope, query);
  if (!result) notFound();
  // A page number beyond the last page is a missing page, not an empty list.
  if (query.page > 1 && result.cards.length === 0) notFound();

  const { header } = result;
  const filtered = hasFilters(query);
  const links = pageLinks(header.basePath, query, result.totalPages);
  const listScope =
    scope.kind === 'shop'
      ? ({ kind: 'shop', path: scope.path } as const)
      : ({ kind: 'collection', slug: scope.slug } as const);
  // The query string for "Load more": everything but the page number.
  const search = listingSearch({ ...query, page: 1 });

  const structured = collectionPage({
    name: header.title,
    description: header.description,
    path: listingHref(header.basePath, { ...EMPTY_QUERY, page: query.page }),
    items: result.cards.map((card) => ({
      name: card.title,
      path: `/products/${card.slug}`,
      image: card.image?.url ?? null,
    })),
    breadcrumb: header.breadcrumb.map((item) => ({
      name: item.label,
      ...(item.href ? { path: item.href } : {}),
    })),
  });

  return (
    <>
      <ListingHeader
        breadcrumb={header.breadcrumb}
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        hero={header.hero}
        links={header.children}
      />
      <ListingControls
        basePath={header.basePath}
        query={query}
        facets={result.facets}
        total={result.total}
      />
      <ActiveFilters basePath={header.basePath} query={query} />

      {result.cards.length === 0 ? (
        <ListingEmpty
          basePath={header.basePath}
          query={query}
          filtered={filtered}
          suggestions={await withLiveStock(result.suggestions)}
        />
      ) : (
        <div className="container-page pt-10 pb-20 md:pt-14 md:pb-32">
          <Suspense
            fallback={
              <GridWith
                cards={result.cards}
                query={query}
                priorityCount={query.page === 1 ? 4 : 0}
                label={header.title}
              />
            }
          >
            <StockGrid result={result} query={query} priorityCount={query.page === 1 ? 4 : 0} />
          </Suspense>
          <LoadMore
            key={`${search}#${query.page}`}
            loadMore={loadMoreProducts}
            scope={listScope}
            search={search}
            page={query.page}
            hasMore={query.page < result.totalPages}
            shown={(query.page - 1) * result.pageSize + result.cards.length}
            total={result.total}
            density={query.density}
            sizes={gridImageSizes(query.density)}
            pagination={
              <Pagination page={query.page} totalPages={result.totalPages} hrefFor={links.href} />
            }
          />
        </div>
      )}
      <JsonLd data={structured} />
    </>
  );
}
