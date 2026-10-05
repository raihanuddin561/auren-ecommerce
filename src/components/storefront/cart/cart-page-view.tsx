'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import type { CartView } from '@/modules/cart/view';
import { CartHydrator } from './cart-hydrator';
import { CartLine } from './cart-line';
import { useCartView } from './cart-store';
import { CartTotals, TRUST_LINES } from './cart-summary';
import { FreeDeliveryBar } from './free-delivery-bar';

/**
 * The bag page. The server renders it with the bag it just read; after that the shared bag store
 * keeps it current as the shopper changes quantities, removes lines or undoes a removal.
 */
export function CartPageView({ initial }: { initial: CartView }) {
  const stored = useCartView();
  const view = stored ?? initial;
  const empty = view.lines.length === 0;

  return (
    <>
      <CartHydrator view={initial} />
      {empty ? (
        <EmptyState
          icon={<Icon icon={ShoppingBag} size={32} />}
          title="Your bag is empty"
          description="Pieces you add will wait here until you are ready."
          action={
            <Button asChild>
              <Link href="/shop">Explore the collection</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <section aria-label="Items in your bag" className="lg:col-span-7">
            <ul className="divide-y divide-line">
              {view.lines.map((line) => (
                <CartLine key={line.variantId} line={line} />
              ))}
            </ul>
          </section>

          <aside
            aria-label="Order summary"
            className="flex flex-col gap-6 self-start border border-line bg-raised p-6 lg:sticky lg:top-28 lg:col-span-5 lg:p-8"
          >
            <h2 className="type-h3 text-fg">Summary</h2>
            <FreeDeliveryBar view={view} />
            <CartTotals view={view} />
            {view.hasIssues ? (
              <p role="alert" className="type-small text-danger-text">
                Some pieces need your attention before you can check out.
              </p>
            ) : null}
            <Button
              asChild
              size="lg"
              fullWidth
              aria-disabled={view.hasIssues || undefined}
              className={view.hasIssues ? 'pointer-events-none opacity-50' : undefined}
            >
              <Link href="/checkout">Checkout</Link>
            </Button>
            <ul className="flex flex-col gap-1 border-t border-line pt-5 type-small text-fg-muted">
              {TRUST_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
