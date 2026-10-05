import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CartPageView } from '@/components/storefront/cart/cart-page-view';
import { Skeleton } from '@/components/ui/skeleton';
import { getCartView } from '@/modules/cart/queries';

export const metadata: Metadata = {
  title: 'Your bag',
  robots: { index: false, follow: false },
};

async function CartContent() {
  return <CartPageView initial={await getCartView()} />;
}

function CartSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16" aria-hidden="true">
      <div className="flex flex-col gap-6 lg:col-span-7">
        {[0, 1].map((n) => (
          <div key={n} className="flex gap-4">
            <Skeleton className="w-24 md:w-32" style={{ aspectRatio: '4 / 5' }} />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-72 lg:col-span-5" />
    </div>
  );
}

/** The bag page: dynamic (it reads the bag cookie), never indexed. */
export default function CartPage() {
  return (
    <section className="container-page py-12 md:py-20">
      <p className="type-eyebrow text-accent-text">Your bag</p>
      <h1 className="mt-3 mb-10 type-h1 text-fg md:mb-14">Review your pieces</h1>
      <Suspense fallback={<CartSkeleton />}>
        <CartContent />
      </Suspense>
    </section>
  );
}
