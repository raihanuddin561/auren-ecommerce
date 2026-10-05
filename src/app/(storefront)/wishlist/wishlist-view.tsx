'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ProductGrid } from '@/components/storefront/catalog/product-grid';
import { readWishlistIds, useWishlistIds } from '@/components/storefront/catalog/wishlist-button';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProductCardData } from '@/modules/catalog/card';
import { loadWishlistCards } from './actions';

type State =
  { status: 'loading' } | { status: 'ready'; cards: ProductCardData[] } | { status: 'error' };

const noop = () => () => {};

export function WishlistView() {
  // False while the server renders: the list lives in the browser, so there is nothing to claim yet.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const ids = useWishlistIds();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    const wanted = readWishlistIds();
    if (wanted.length === 0) return;
    loadWishlistCards({ ids: [...wanted] })
      .then((result) => {
        if (cancelled) return;
        setState(result.ok ? { status: 'ready', cards: result.data } : { status: 'error' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  // Nothing saved needs no round trip.
  if (hydrated && ids.length === 0) return <EmptyWishlist />;
  if (!hydrated || state.status === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} style={{ aspectRatio: '4 / 5' }} />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <EmptyState
        tone="error"
        title="We could not load your wishlist"
        description="Nothing was lost. Try again in a moment."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }
  if (state.cards.length === 0) return <EmptyWishlist />;
  return <ProductGrid products={state.cards} label="Saved pieces" />;
}

function EmptyWishlist() {
  return (
    <EmptyState
      icon={<Icon icon={Heart} size={32} />}
      title="Nothing saved yet"
      description="Tap the heart on a piece you like and it will wait here, on this device."
      action={
        <Button asChild>
          <Link href="/shop">Explore the collection</Link>
        </Button>
      }
    />
  );
}
