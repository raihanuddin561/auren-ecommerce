'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { refreshCart } from '@/modules/cart/actions';
import { CartLine } from './cart-line';
import { closeCartDrawer, setCartView, useCartDrawerOpen, useCartView } from './cart-store';
import { CartTotals } from './cart-summary';
import { FreeDeliveryBar } from './free-delivery-bar';

/**
 * The bag drawer. It opens after "Add to bag" and from the header bag, and refreshes from the
 * server whenever it opens so stock and prices are never stale.
 */
export function CartDrawer() {
  const open = useCartDrawerOpen();
  const view = useCartView();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    refreshCart()
      .then((result) => {
        if (!cancelled && result.ok) setCartView(result.data.view);
      })
      .catch(() => {
        // The view already shown stays; the next action refreshes it.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const empty = !view || view.lines.length === 0;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : closeCartDrawer())}>
      <SheetContent side="right" aria-describedby="bag-drawer-description">
        <SheetHeader>
          <SheetTitle>Your bag{view && view.count > 0 ? ` (${view.count})` : ''}</SheetTitle>
          <SheetDescription id="bag-drawer-description" className="sr-only">
            The pieces in your bag, with quantity, price and the way to checkout.
          </SheetDescription>
        </SheetHeader>

        {empty ? (
          <SheetBody className="flex items-center">
            <EmptyState
              className="w-full border-0 py-16"
              icon={
                <div className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/5 text-gold">
                  <Icon icon={ShoppingBag} size={24} />
                </div>
              }
              title="Your Bag Awaits"
              description="Discover bespoke tailoring, noble fibers, and modern menswear in our seasonal edit."
              action={
                <Button asChild variant="primary" onClick={closeCartDrawer} className="mt-2">
                  <Link href="/shop">Explore The Collection</Link>
                </Button>
              }
            />
          </SheetBody>
        ) : (
          <>
            <SheetBody>
              <ul className="divide-y divide-line">
                {view.lines.map((line) => (
                  <CartLine key={line.variantId} line={line} compact />
                ))}
              </ul>
            </SheetBody>
            <SheetFooter>
              <FreeDeliveryBar view={view} />
              <CartTotals view={view} />
              <Button
                asChild
                size="lg"
                fullWidth
                aria-disabled={view.hasIssues || undefined}
                className={view.hasIssues ? 'pointer-events-none opacity-50' : undefined}
              >
                <Link href="/checkout" onClick={closeCartDrawer}>
                  Checkout
                </Link>
              </Button>
              <Button asChild variant="secondary" fullWidth>
                <Link href="/cart" onClick={closeCartDrawer}>
                  View bag
                </Link>
              </Button>
              <div className="flex flex-col items-center gap-1.5 rounded-xs border border-line/60 bg-raised/30 p-2.5 text-center">
                <p className="type-caption font-medium text-fg">
                  ✦ Cash on Delivery Across 64 Districts · Doorstep Inspection
                </p>
                <div className="flex items-center justify-center gap-2 type-caption font-mono tracking-wider text-gold-strong uppercase dark:text-gold">
                  <span>Cash</span>
                  <span>·</span>
                  <span>bKash</span>
                  <span>·</span>
                  <span>Nagad</span>
                  <span>·</span>
                  <span>Cards</span>
                </div>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
