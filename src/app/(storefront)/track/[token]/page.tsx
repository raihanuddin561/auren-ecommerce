import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { OrderConfirmation } from '@/components/storefront/order/order-confirmation';
import { UnlockForm } from '@/components/storefront/order/track-forms';
import { Skeleton } from '@/components/ui/skeleton';
import { viewForToken } from '@/modules/orders/queries';
import { PROOF_COOKIE, isTrackingToken, verifyOrderProof } from '@/modules/orders/tracking';
import { StyleItWith } from './style-it-with';

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
  // The address carries a private link: it must never be sent on as a referrer.
  referrer: 'no-referrer',
};

async function OrderContent({
  params,
  searchParams,
}: Pick<PageProps<'/track/[token]'>, 'params' | 'searchParams'>) {
  const { token } = await params;
  const { placed } = await searchParams;
  const proof = (await cookies()).get(PROOF_COOKIE)?.value;

  // An unknown token and a missing second factor look the same: the page asks for the phone or
  // email. Nothing about the order is shown before that.
  const view = isTrackingToken(token)
    ? await viewForToken(token, (orderId) => verifyOrderProof(proof, orderId))
    : null;

  if (!view) {
    return (
      <section className="container-page py-12 md:py-20">
        <p className="type-eyebrow text-accent-text">Your order</p>
        <h1 className="mt-3 type-h1 text-fg">Confirm it is you</h1>
        <p className="mt-4 mb-10 max-w-xl type-body text-fg-muted">
          To keep your order private, enter the phone number or email address you used when you
          placed it.
        </p>
        <UnlockForm token={isTrackingToken(token) ? token : 'x'.repeat(22)} />
      </section>
    );
  }
  return (
    <OrderConfirmation
      order={view}
      justPlaced={placed === '1' && view.status === 'placed'}
      token={token}
      extra={
        <Suspense fallback={null}>
          <StyleItWith />
        </Suspense>
      }
    />
  );
}

function OrderSkeleton() {
  return (
    <div className="container-page py-12 md:py-20" aria-hidden="true">
      <Skeleton className="mx-auto h-4 w-32" />
      <Skeleton className="mx-auto mt-4 h-14 w-80 max-w-full" />
      <Skeleton className="mx-auto mt-8 h-24 max-w-2xl" />
    </div>
  );
}

export default function TrackOrderPage(props: PageProps<'/track/[token]'>) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
