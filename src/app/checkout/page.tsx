import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckoutForm } from '@/components/storefront/checkout/checkout-form';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getCheckoutSummary } from '@/modules/checkout/queries';
import { getDivisionsAndDistricts } from '@/modules/shipping/queries';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

async function CheckoutContent() {
  const [summary, areas] = await Promise.all([getCheckoutSummary(), getDivisionsAndDistricts()]);

  if (summary.cart.lines.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty"
        description="Add a piece to your bag and come back to check out."
        action={
          <Button asChild>
            <Link href="/shop">Explore the collection</Link>
          </Button>
        }
      />
    );
  }
  if (summary.cart.hasIssues) {
    return (
      <EmptyState
        tone="error"
        title="Please review your bag"
        description="Some pieces are no longer available in the quantity you chose. Update your bag and we will take you straight back."
        action={
          <Button asChild>
            <Link href="/cart">Review your bag</Link>
          </Button>
        }
      />
    );
  }
  return <CheckoutForm initial={summary} areas={areas} />;
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16" aria-hidden="true">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="mt-6 h-6 w-48" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="hidden h-96 lg:col-span-5 lg:block" />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <p className="type-eyebrow text-accent-text">Checkout</p>
      <h1 className="mt-3 mb-10 type-h1 text-fg md:mb-14">Almost yours</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutContent />
      </Suspense>
    </>
  );
}
