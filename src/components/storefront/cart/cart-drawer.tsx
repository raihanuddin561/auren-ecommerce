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
              className="w-full border-0"
              icon={<Icon icon={ShoppingBag} size={28} />}
              title="Your bag is empty"
              description="Pieces you add will wait here."
              action={
                <Button asChild variant="secondary" onClick={closeCartDrawer}>
                  <Link href="/shop">Explore the collection</Link>
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
              <div className="flex flex-col items-center gap-1 pt-1 text-center">
                <p className="type-caption text-fg-muted">
                  Cash on delivery across 64 districts &middot; Doorstep inspection
                </p>
                <div className="text-fg-subtle flex items-center justify-center gap-1.5 text-[10px] tracking-wider uppercase">
                  <span>Cash</span>
                  <span>&bull;</span>
                  <span>bKash</span>
                  <span>&bull;</span>
                  <span>Nagad</span>
                  <span>&bull;</span>
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
