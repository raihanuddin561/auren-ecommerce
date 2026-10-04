import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ListingSkeleton } from '@/components/storefront/catalog/listing-parts';
import type { RawSearchParams } from '@/modules/catalog/listing';
import { ListingContent, listingMetadata } from '../../_listing/listing-page';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/collections/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return { title: 'Page not found', robots: { index: false, follow: false } };
  return listingMetadata({ kind: 'collection', slug }, (await searchParams) as RawSearchParams);
}

async function CollectionListing({ params, searchParams }: PageProps<'/collections/[slug]'>) {
  const { slug } = await params;
  // Draft and scheduled collections are not found either: the query only returns live ones.
  if (!SLUG.test(slug)) notFound();
  return (
    <ListingContent
      scope={{ kind: 'collection', slug }}
      searchParams={searchParams as Promise<RawSearchParams>}
    />
  );
}

export default function CollectionPage(props: PageProps<'/collections/[slug]'>) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CollectionListing {...props} />
    </Suspense>
  );
}
