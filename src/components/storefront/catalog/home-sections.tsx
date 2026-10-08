import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { SkeletonRegion } from '@/components/ui/skeleton';
import { CategoryTiles, CategoryTilesSkeleton, type CategoryTileView } from './category-tiles';
import { CollectionRail, type CollectionRailView } from './collection-rail';
import type { ProductCardView } from './product-card';
import { ProductGrid, ProductGridSkeleton } from './product-grid';
import { SectionHeader } from './section-header';

/**
 * The catalogue sections of the home page. They are presentational: the page reads the cached
 * catalogue queries and passes the data in, so each section can sit in its own Suspense boundary.
 * A section with nothing to show renders nothing, so an empty catalogue leaves only the hero.
 */

export function CategoriesSection({ categories }: { categories: CategoryTileView[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="home-categories" className="pt-12 pb-20 md:pt-16 md:pb-28">
      <div className="container-page">
        <Reveal>
          <SectionHeader id="home-categories" eyebrow="Categories" title="Shop by category" />
        </Reveal>
        <Reveal>
          <CategoryTiles categories={categories} />
        </Reveal>
      </div>
    </section>
  );
}

export function NewArrivalsSection({ products }: { products: ProductCardView[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="home-new-arrivals" className="py-20 md:py-32">
      <div className="container-page">
        <Reveal>
          <SectionHeader
            id="home-new-arrivals"
            eyebrow="Just in"
            title="New arrivals"
            action={
              <Button asChild variant="link">
                <Link href="/shop">Shop all</Link>
              </Button>
            }
          />
        </Reveal>
        <Reveal>
          <ProductGrid products={products} label="New arrivals" />
        </Reveal>
      </div>
    </section>
  );
}

export function FeaturedCollectionsSection({ collections }: { collections: CollectionRailView[] }) {
  // A collection without products has nothing to show.
  const shown = collections.filter((collection) => collection.products.length > 0);
  return (
    <>
      {shown.map((collection) => (
        <CollectionRail
          key={collection.id}
          collection={collection}
          headingId={`home-collection-${collection.slug}`}
        />
      ))}
    </>
  );
}

/** Skeletons keep each section's final height, so nothing moves when the data arrives. */
function SectionSkeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SkeletonRegion label={label} className="py-20 md:py-32">
      <div className="container-page">
        <div className="mb-10 md:mb-14" aria-hidden="true">
          <div className="h-3 w-20 animate-skeleton bg-skeleton" />
          <div className="mt-4 h-10 w-64 max-w-full animate-skeleton bg-skeleton" />
        </div>
        {children}
      </div>
    </SkeletonRegion>
  );
}

export function CategoriesSkeleton() {
  return (
    <SectionSkeleton label="Loading categories">
      <CategoryTilesSkeleton />
    </SectionSkeleton>
  );
}

export function NewArrivalsSkeleton() {
  return (
    <SectionSkeleton label="Loading new arrivals">
      <ProductGridSkeleton count={4} />
    </SectionSkeleton>
  );
}

export function FeaturedCollectionsSkeleton() {
  return (
    <SectionSkeleton label="Loading collections">
      <ProductGridSkeleton count={4} />
    </SectionSkeleton>
  );
}
