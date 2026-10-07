import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import {
  CategoriesSection,
  CategoriesSkeleton,
  FeaturedCollectionsSection,
  FeaturedCollectionsSkeleton,
  NewArrivalsSection,
  NewArrivalsSkeleton,
} from '@/components/storefront/catalog/home-sections';
import { HeroCarousel, HeroCarouselSkeleton } from '@/components/storefront/home/hero-carousel';
import { BrandPerks } from '@/components/storefront/home/brand-perks';
import { withLiveStock } from './_listing/load';
import {
  getFeaturedCollections,
  getNewArrivals,
  getTopCategories,
} from '@/modules/catalog/queries';
import { getHeroCarouselForStorefront } from '@/modules/settings/queries';

export const metadata: Metadata = {
  title: { absolute: 'AUREN | Modern, refined menswear' },
  alternates: { canonical: '/' },
};

// Each section reads a cached catalogue/storefront query and renders nothing when there is no data.
// They resolve at request time (connection), so a build never needs a database; the queries themselves
// are cached and invalidated by tags.
async function Hero() {
  await connection();
  const settings = await getHeroCarouselForStorefront();
  return <HeroCarousel settings={settings} />;
}

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

/** Dynamic customizable hero carousel, then the catalogue sections that have something to show. */
export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HeroCarouselSkeleton />}>
        <Hero />
      </Suspense>

      <BrandPerks />

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
