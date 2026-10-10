import type { Metadata } from 'next';
import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { StorefrontShell } from '@/components/storefront/storefront-shell';
import { organizationJsonLd, siteOrigin, websiteJsonLd } from '@/lib/seo/jsonld';
import { CartIsland } from './_cart/cart-island';
import { StorefrontHeaderSuspense } from './_header/storefront-header';

// Canonical and Open Graph addresses are resolved against the public site address.
export const metadata: Metadata = { metadataBase: new URL(siteOrigin()) };

export default function StorefrontLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <StorefrontShell
        header={<StorefrontHeaderSuspense />}
        cartIsland={
          // Reads the bag cookie, so it is dynamic: the rest of the page stays static around it.
          <Suspense fallback={null}>
            <CartIsland />
          </Suspense>
        }
      >
        {children}
      </StorefrontShell>
    </>
  );
}
