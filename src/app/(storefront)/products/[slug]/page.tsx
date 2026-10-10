import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/storefront/catalog/product-grid';
import { SectionHeader } from '@/components/storefront/catalog/section-header';
import { PdpState } from '@/components/storefront/pdp/pdp-state';
import { ProductGallery } from '@/components/storefront/pdp/product-gallery';
import {
  ProductAccordions,
  ProductHeading,
  TrustRow,
} from '@/components/storefront/pdp/product-info';
import { RecentlyViewed } from '@/components/storefront/pdp/recently-viewed';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { getProductPage, getRelatedProducts } from '@/modules/catalog/queries';
import { withLiveStock } from '../../_listing/load';
import { LiveBuyBox, LiveStructuredData } from './_live';

const withoutSuffix = (title: string) => title.replace(/\s*\|\s*AUREN\s*$/i, '').trim();

/** Title, description and the one canonical address of a product. Cached with the shell. */
export async function generateMetadata({
  params,
}: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductPage(slug);
  if (!product) return { title: 'Page not found', robots: { index: false, follow: false } };
  const raw = product.seoDescription ?? product.description[0] ?? product.subtitle ?? undefined;
  const description = raw && raw.length > 160 ? `${raw.slice(0, 157).trimEnd()}...` : raw;
  const path = `/products/${product.slug}`;
  return {
    title: withoutSuffix(product.seoTitle ?? product.title),
    description,
    alternates: { canonical: path },
    // A page with nothing to buy is kept out of the index until it has an active variant.
    ...(product.variants.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      title: withoutSuffix(product.seoTitle ?? product.title),
      ...(description ? { description } : {}),
      url: path,
    },
    twitter: { card: 'summary_large_image' },
  };
}

function BuyBoxSkeleton() {
  return (
    <div role="status" aria-label="Loading price and stock" className="flex flex-col gap-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-3/4" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

async function RelatedProducts({
  productId,
  categoryId,
}: {
  productId: string;
  categoryId: string | null;
}) {
  const cards = await withLiveStock(await getRelatedProducts(productId, categoryId, 4));
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="related" className="container-page py-16 md:py-24">
      <SectionHeader id="related" eyebrow="Continue browsing" title="You may also like" />
      <ProductGrid products={cards} label="You may also like" />
    </section>
  );
}

import { PdpReviewsSection } from '@/components/storefront/reviews/pdp-reviews-section';
import { getProductRatingStatsQuery, getProductReviewsQuery } from '@/modules/reviews/queries';

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;
  const product = await getProductPage(slug);
  if (!product) notFound();

  const [reviewsData, ratingStats] = await Promise.all([
    getProductReviewsQuery(product.id, { limit: 20 }),
    getProductRatingStatsQuery(product.id),
  ]);

  const firstColor = product.colors[0]?.id ?? null;
  const lead = product.images.find((image) => image.colorId === firstColor) ?? product.images[0];

  return (
    <>
      <div className="container-page pt-6 pb-16 md:pt-8 md:pb-24">
        <Breadcrumb
          className="mb-6"
          items={product.breadcrumb.map((crumb, index, all) => ({
            label: crumb.name,
            ...(index === all.length - 1 ? {} : { href: crumb.href }),
          }))}
        />
        <PdpState initialColorId={firstColor}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
            <div className="min-w-0 overflow-x-clip">
              <ProductGallery images={product.images} title={product.title} />
            </div>
            <div className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
              <ProductHeading product={product} stats={ratingStats} />
              <Suspense fallback={<BuyBoxSkeleton />}>
                <LiveBuyBox product={product} />
              </Suspense>
              <TrustRow />
              <ProductAccordions product={product} />
            </div>
          </div>
        </PdpState>
      </div>

      <PdpReviewsSection
        productId={product.id}
        productTitle={product.title}
        productSlug={product.slug}
        stats={ratingStats}
        initialReviews={reviewsData.items}
      />

      <Suspense fallback={null}>
        <RelatedProducts productId={product.id} categoryId={product.categoryId} />
      </Suspense>
      <RecentlyViewed
        current={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          imageUrl: lead?.url ?? null,
          imageAlt: lead?.alt ?? null,
          dominantColor: lead?.dominantColor ?? null,
        }}
      />
      <Suspense fallback={null}>
        <LiveStructuredData product={product} />
      </Suspense>
    </>
  );
}
