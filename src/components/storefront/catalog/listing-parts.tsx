import Link from 'next/link';
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRegion } from '@/components/ui/skeleton';
import { listingHref, type Density, type ListingQuery } from '@/modules/catalog/listing';
import { CatalogImage } from './catalog-image';
import type { ProductCardView } from './product-card';
import { ProductGrid, ProductGridSkeleton } from './product-grid';

interface ListingHeaderProps {
  breadcrumb: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string | null;
  hero: { url: string; alt: string } | null;
  links: Array<{ label: string; href: string }>;
}

/** Editorial header: breadcrumb, title, a short paragraph, an optional hero and sub-category links. */
export function ListingHeader({
  breadcrumb,
  eyebrow,
  title,
  description,
  hero,
  links,
}: ListingHeaderProps) {
  return (
    <header className="container-page pt-10 pb-10 md:pt-14 md:pb-14">
      <Breadcrumb items={breadcrumb} />
      {hero ? (
        <div className="relative mt-8 aspect-4/3 overflow-hidden bg-sunken md:aspect-21/9">
          <CatalogImage
            src={hero.url}
            alt={hero.alt}
            sizes="(min-width: 1440px) 1360px, 100vw"
            priority
          />
        </div>
      ) : null}
      <div className="mt-8 max-w-2xl">
        <p className="type-eyebrow text-accent-text">{eyebrow}</p>
        <h1 className="mt-3 type-h1 text-fg">{title}</h1>
        {description ? (
          <p className="mt-4 type-body text-pretty text-fg-muted">{description}</p>
        ) : null}
      </div>
      {links.length > 0 ? (
        <nav aria-label="Browse" className="mt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="touch-target inline-flex min-h-11 items-center type-small text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

interface ActiveFilter {
  label: string;
  href: string;
}

/** What is switched on, as links that switch each one off again. */
export function activeFilters(basePath: string, query: ListingQuery): ActiveFilter[] {
  const without = (patch: Partial<ListingQuery>) =>
    listingHref(basePath, { ...query, ...patch, page: 1 });
  const list: ActiveFilter[] = [];
  for (const value of query.size) {
    list.push({
      label: `Size ${value}`,
      href: without({ size: query.size.filter((v) => v !== value) }),
    });
  }
  for (const value of query.color) {
    list.push({
      label: value.replace(/-/g, ' '),
      href: without({ color: query.color.filter((v) => v !== value) }),
    });
  }
  for (const value of query.fit) {
    list.push({
      label: `${value} fit`,
      href: without({ fit: query.fit.filter((v) => v !== value) }),
    });
  }
  for (const value of query.fabric) {
    list.push({ label: value, href: without({ fabric: query.fabric.filter((v) => v !== value) }) });
  }
  if (query.minPrice !== null || query.maxPrice !== null) {
    const range =
      query.minPrice !== null && query.maxPrice !== null
        ? `৳${query.minPrice} to ৳${query.maxPrice}`
        : query.minPrice !== null
          ? `From ৳${query.minPrice}`
          : `Up to ৳${query.maxPrice}`;
    list.push({ label: range, href: without({ minPrice: null, maxPrice: null }) });
  }
  if (query.inStock) list.push({ label: 'In stock only', href: without({ inStock: false }) });
  return list;
}

export function ActiveFilters({ basePath, query }: { basePath: string; query: ListingQuery }) {
  const filters = activeFilters(basePath, query);
  if (filters.length === 0) return null;
  return (
    <div className="container-page flex flex-wrap items-center gap-2 pt-5">
      <p className="type-eyebrow text-fg-muted">Filtered by</p>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <li key={filter.label}>
            <Link
              href={filter.href}
              replace
              scroll={false}
              className="touch-target inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong px-4 type-small text-fg capitalize hover:border-fg"
            >
              {filter.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">, remove filter</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ListingEmptyProps {
  basePath: string;
  query: ListingQuery;
  suggestions: ProductCardView[];
  filtered: boolean;
}

/** Nothing matches: say so, offer to clear the filters, and show a few new pieces. */
export function ListingEmpty({ basePath, query, suggestions, filtered }: ListingEmptyProps) {
  const clearHref = listingHref(basePath, {
    ...query,
    size: [],
    color: [],
    fit: [],
    fabric: [],
    minPrice: null,
    maxPrice: null,
    inStock: false,
    page: 1,
  });
  return (
    <div className="container-page py-14 md:py-20">
      <EmptyState
        title={
          filtered ? 'No pieces match these filters' : 'The Atelier is Tailoring This Collection'
        }
        description={
          filtered
            ? 'Try removing a filter or two, or start again from everything in this edit.'
            : 'Pieces for this capsule are currently being handcrafted by our master artisans in Dhaka. In the meantime, explore our active seasonal arrivals.'
        }
        action={
          filtered ? (
            <Button asChild variant="primary">
              <Link href={clearHref} replace scroll={false}>
                Clear filters
              </Link>
            </Button>
          ) : (
            <Button asChild variant="primary">
              <Link href="/shop">Explore active collection</Link>
            </Button>
          )
        }
      />
      {suggestions.length > 0 ? (
        <section aria-labelledby="listing-suggestions" className="mt-16">
          <h2 id="listing-suggestions" className="mb-8 type-h2 text-fg">
            New arrivals
          </h2>
          <ProductGrid products={suggestions} label="New arrivals" />
        </section>
      ) : null}
    </div>
  );
}

/** Same bones as the page: header, bar and a grid of 4:5 cards, so nothing moves when data arrives. */
export function ListingSkeleton({ density = null }: { density?: Density | null }) {
  return (
    <SkeletonRegion label="Loading products">
      <div className="container-page pt-10 pb-10 md:pt-14 md:pb-14" aria-hidden="true">
        <div className="h-4 w-40 animate-skeleton bg-skeleton" />
        <div className="mt-8 h-3 w-24 animate-skeleton bg-skeleton" />
        <div className="mt-4 h-12 w-72 max-w-full animate-skeleton bg-skeleton" />
        <div className="mt-4 h-4 w-full max-w-md animate-skeleton bg-skeleton" />
      </div>
      <div className="border-y border-line" aria-hidden="true">
        <div className="container-page flex min-h-14 items-center gap-3 py-2">
          <div className="h-10 w-24 animate-skeleton rounded-full bg-skeleton" />
          <div className="ml-auto h-11 w-44 animate-skeleton bg-skeleton" />
        </div>
      </div>
      <div className="container-page pt-10 pb-20 md:pt-14 md:pb-32">
        <ProductGridSkeleton count={8} density={density} />
      </div>
    </SkeletonRegion>
  );
}
