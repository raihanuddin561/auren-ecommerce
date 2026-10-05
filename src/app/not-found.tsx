import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotFoundContent } from '@/components/storefront/not-found-content';
import { StorefrontShell } from '@/components/storefront/storefront-shell';
import { CartIsland } from './(storefront)/_cart/cart-island';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/** Unmatched URLs: no layout wraps them, so this page brings the storefront shell itself. */
export default function NotFound() {
  return (
    <StorefrontShell
      cartIsland={
        <Suspense fallback={null}>
          <CartIsland />
        </Suspense>
      }
    >
      <NotFoundContent />
    </StorefrontShell>
  );
}
