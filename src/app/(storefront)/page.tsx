import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ImageFrame } from '@/components/motion/image-frame';
import { Reveal } from '@/components/motion/reveal';
import {
  CategoriesSection,
  CategoriesSkeleton,
  FeaturedCollectionsSection,
  FeaturedCollectionsSkeleton,
  NewArrivalsSection,
  NewArrivalsSkeleton,
} from '@/components/storefront/catalog/home-sections';
import { Button } from '@/components/ui/button';
import { withLiveStock } from './_listing/load';
import {
  getFeaturedCollections,
  getNewArrivals,
  getTopCategories,
} from '@/modules/catalog/queries';

export const metadata: Metadata = {
  title: { absolute: 'AUREN | Modern, refined menswear' },
  alternates: { canonical: '/' },
};

// Each section reads a cached catalogue query and renders nothing when there is no data. They
// resolve at request time (connection), so a build never needs a database; the queries themselves
// are cached and invalidated by the catalogue tags.
async function Categories() {
  await connection();
  return <CategoriesSection categories={await getTopCategories()} />;
}

async function NewArrivals() {
  await connection();
  // Cached cards, live stock: the badges and the size row never go stale.
  return <NewArrivalsSection products={await withLiveStock(await getNewArrivals(8))} />;
}

async function FeaturedCollections() {
  await connection();
  const collections = await getFeaturedCollections(2, 4);
  const stocked = await withLiveStock(collections.flatMap((collection) => collection.products));
  const byId = new Map(stocked.map((card) => [card.id, card]));
  return (
    <FeaturedCollectionsSection
      collections={collections.map((collection) => ({
        ...collection,
        products: collection.products.map((card) => byId.get(card.id) ?? card),
      }))}
    />
  );
}

/** One ink hero, then the catalogue sections that have something to show. */
export default function HomePage() {
  return (
    <>
      <section
        data-tone="ink"
        className="relative flex min-h-svh flex-1 items-end bg-page pt-(--header-height) text-fg"
      >
        <div className="container-page grid items-end gap-12 pb-16 md:grid-cols-12 md:pb-24">
          <Reveal className="md:col-span-7">
            <p className="type-eyebrow text-accent-text">AUREN</p>
            <h1 className="mt-5 max-w-4xl type-display-xl text-fg">Modern, refined menswear</h1>
            <p className="mt-6 max-w-xl type-body text-pretty text-fg-muted">
              Elevated essentials and tailoring, crafted in breathable fabrics and made to be worn
              for years.
            </p>
            <div className="mt-10">
              <Button asChild variant="primary" size="lg">
                <Link href="/shop">Explore the collection</Link>
              </Button>
            </div>
          </Reveal>
          {/* Stand-in for campaign photography; decorative, so no alt text. */}
          <div className="hidden md:col-span-4 md:col-start-9 md:block">
            <ImageFrame src="/seed/charcoal.svg" alt="" sizes="30vw" priority />
          </div>
        </div>
      </section>

      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories />
      </Suspense>
      <Suspense fallback={<NewArrivalsSkeleton />}>
        <NewArrivals />
      </Suspense>
      <Suspense fallback={<FeaturedCollectionsSkeleton />}>
        <FeaturedCollections />
      </Suspense>
    </>
  );
}
