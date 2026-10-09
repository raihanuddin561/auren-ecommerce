import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, Search as SearchIcon } from 'lucide-react';
import { ProductGrid } from '@/components/storefront/catalog/product-grid';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { getSearchResults } from '@/modules/search/queries';
import { withLiveStock } from '../_listing/load';

export const metadata: Metadata = {
  title: 'Search — AUREN',
  description:
    'Search the AUREN menswear collection for luxury garments, noble fibers, and tailored silhouettes.',
  robots: { index: false, follow: true },
};

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

async function SearchResults({ query }: { query: string }) {
  const clean = query.trim();
  const { total, cards, suggestions, popularSearches } = await getSearchResults(clean);

  const displayCards = await withLiveStock(cards);
  const displaySuggestions = await withLiveStock(suggestions);

  return (
    <div className="flex flex-col gap-12">
      {/* Search Header and Refinement Bar */}
      <div className="flex flex-col gap-4 border-b border-line pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-eyebrow tracking-widest text-accent-text">Collection Discovery</p>
            <h1 className="mt-2 font-serif text-3xl text-fg md:text-4xl">
              {clean ? `Results for “${clean}”` : 'Search the Collection'}
            </h1>
            <p className="mt-2 type-body text-fg-muted">
              {clean
                ? `${total} ${total === 1 ? 'piece' : 'pieces'} curated in our archives`
                : 'Explore refined tailoring, noble natural fibers, and timeless outerwear.'}
            </p>
          </div>

          {/* Quick Search Form */}
          <form action="/search" method="get" className="relative w-full sm:w-80">
            <Input
              name="q"
              defaultValue={clean}
              placeholder="Search garments..."
              className="pr-10"
              autoComplete="off"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted transition-auren-fast hover:text-fg"
            >
              <Icon icon={SearchIcon} size={16} />
            </button>
          </form>
        </div>

        {/* Popular searches chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="type-eyebrow text-fg-muted">Popular:</span>
          {popularSearches.map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="border border-line bg-raised px-3 py-1 type-small text-fg transition-auren-fast hover:border-gold hover:bg-fg/5"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Results Grid */}
      {displayCards.length > 0 ? (
        <ProductGrid
          products={displayCards}
          label={`Search results for ${clean}`}
          priorityCount={4}
        />
      ) : clean ? (
        /* Zero Results Empty State + Suggestions */
        <div className="flex flex-col gap-12">
          <div className="border border-line bg-raised p-8 text-center md:p-12">
            <h2 className="font-serif text-2xl text-fg">No exact pieces found</h2>
            <p className="mx-auto mt-2 max-w-md type-body text-fg-muted">
              We couldn&apos;t find any garments matching &ldquo;{clean}&rdquo;. You may wish to try
              different keywords or browse our recommended signatures below.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary">
                <Link href="/shop">Browse All Pieces</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/collections/new-arrivals">New Arrivals</Link>
              </Button>
            </div>
          </div>

          {displaySuggestions.length > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-serif text-2xl text-fg">Curated Signatures</h3>
                <Link
                  href="/shop"
                  className="flex items-center gap-1 type-eyebrow text-fg hover:text-accent-text"
                >
                  <span>Explore full atelier</span>
                  <Icon icon={ArrowRight} size={14} />
                </Link>
              </div>
              <ProductGrid
                products={displaySuggestions}
                label="Suggested garments"
                priorityCount={4}
              />
            </div>
          ) : null}
        </div>
      ) : (
        /* Fresh Search Landing when no q is provided */
        <div className="flex flex-col gap-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="border border-line bg-raised p-6">
              <h3 className="type-eyebrow text-accent-text">Tailored Shirts</h3>
              <p className="mt-2 type-small text-fg-muted">
                Crafted from Egyptian Giza 87 cotton and French natural linen with mother-of-pearl
                buttons.
              </p>
              <Link
                href="/shop/shirts"
                className="mt-4 inline-flex items-center gap-1.5 type-eyebrow text-fg hover:underline"
              >
                <span>View shirts</span>
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </div>
            <div className="border border-line bg-raised p-6">
              <h3 className="type-eyebrow text-accent-text">Pleated Trousers</h3>
              <p className="mt-2 type-small text-fg-muted">
                Gurkha waistbands and forward single pleats in Italian tropical wool and structured
                twill.
              </p>
              <Link
                href="/shop/trousers"
                className="mt-4 inline-flex items-center gap-1.5 type-eyebrow text-fg hover:underline"
              >
                <span>View trousers</span>
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </div>
            <div className="border border-line bg-raised p-6">
              <h3 className="type-eyebrow text-accent-text">Knitwear & Polos</h3>
              <p className="mt-2 type-small text-fg-muted">
                18-gauge merino wool and Mongolian cashmere sweaters designed for fluid drape.
              </p>
              <Link
                href="/shop/knitwear"
                className="mt-4 inline-flex items-center gap-1.5 type-eyebrow text-fg hover:underline"
              >
                <span>View knitwear</span>
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </div>
          </div>

          {displaySuggestions.length > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-serif text-2xl text-fg">Featured Signatures</h3>
                <Link
                  href="/shop"
                  className="flex items-center gap-1 type-eyebrow text-fg hover:text-accent-text"
                >
                  <span>Shop all</span>
                  <Icon icon={ArrowRight} size={14} />
                </Link>
              </div>
              <ProductGrid
                products={displaySuggestions}
                label="Featured products"
                priorityCount={4}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const q = resolved.q ?? '';

  return (
    <section className="container-editorial py-12 md:py-16">
      <Suspense
        fallback={
          <div className="flex flex-col gap-8">
            <div className="h-28 animate-skeleton bg-skeleton" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-4/5 animate-skeleton bg-skeleton" />
              ))}
            </div>
          </div>
        }
      >
        <SearchResults query={q} />
      </Suspense>
    </section>
  );
}
