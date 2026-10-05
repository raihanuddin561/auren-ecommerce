'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { openCartDrawer, useCartView } from './cart-store';

/**
 * Header bag. A real link to the bag page (it works without JavaScript); with JavaScript a plain
 * click opens the drawer instead. The count comes from the shared bag store.
 */
export function BagButton({ className }: { className?: string }) {
  const view = useCartView();
  const count = view?.count ?? 0;
  return (
    <Link
      href="/cart"
      prefetch={false}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag, empty'}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        openCartDrawer();
      }}
      className={cn(className)}
    >
      <Icon icon={ShoppingBag} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-0.5 inline-flex min-w-4 items-center justify-center bg-gold px-1 py-0.5 text-eyebrow leading-none text-ink tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
