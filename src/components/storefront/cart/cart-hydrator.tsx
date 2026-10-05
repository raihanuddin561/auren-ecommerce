'use client';

import { useLayoutEffect } from 'react';
import type { CartView } from '@/modules/cart/view';
import { setCartView } from './cart-store';

/** Hands the server's view of the bag to the browser store (renders nothing). */
export function CartHydrator({ view }: { view: CartView }) {
  // Before paint, so the header count never flashes empty after navigation.
  useLayoutEffect(() => {
    setCartView(view);
  }, [view]);
  return null;
}
