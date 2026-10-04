import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ListingSkeleton } from '@/components/storefront/catalog/listing-parts';
import type { RawSearchParams } from '@/modules/catalog/listing';
import type { ListingScope } from '@/modules/catalog/queries';
import { ListingContent, listingMetadata } from '../../_listing/listing-page';

const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DEPTH = 3;

/** `/shop` is everything; `/shop/shirts/oxford` is the category with that path. Anything else is not found. */
function scopeFrom(segments: string[] | undefined): ListingScope | null {
  const parts = segments ?? [];
  if (parts.length > MAX_DEPTH || !parts.every((part) => SEGMENT.test(part))) return null;
  return { kind: 'shop', path: parts.join('/') };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/shop/[[...category]]'>): Promise<Metadata> {
  const scope = scopeFrom((await params).category);
  if (!scope) return { title: 'Page not found', robots: { index: false, follow: false } };
  return listingMetadata(scope, (await searchParams) as RawSearchParams);
}

async function ShopListing({ params, searchParams }: PageProps<'/shop/[[...category]]'>) {
  const scope = scopeFrom((await params).category);
  if (!scope) notFound();
  return <ListingContent scope={scope} searchParams={searchParams as Promise<RawSearchParams>} />;
}

export default function ShopPage(props: PageProps<'/shop/[[...category]]'>) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <ShopListing {...props} />
    </Suspense>
  );
}
