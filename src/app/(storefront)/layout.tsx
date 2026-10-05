import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StorefrontShell } from '@/components/storefront/storefront-shell';
import { siteOrigin } from '@/lib/seo/jsonld';
import { CartIsland } from './_cart/cart-island';

// Canonical and Open Graph addresses are resolved against the public site address.
export const metadata: Metadata = { metadataBase: new URL(siteOrigin()) };

export default function StorefrontLayout({ children }: LayoutProps<'/'>) {
  return (
    <StorefrontShell
      cartIsland={
        // Reads the bag cookie, so it is dynamic: the rest of the page stays static around it.
        <Suspense fallback={null}>
          <CartIsland />
        </Suspense>
      }
    >
      {children}
    </StorefrontShell>
  );
}
