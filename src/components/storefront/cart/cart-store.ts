'use client';

import { useSyncExternalStore } from 'react';
import type { CartView } from '@/modules/cart/view';

/**
 * The bag as the browser knows it, shared by the header count, the drawer, the bag page and every
 * add-to-bag button. The server owns the truth: each action answers with a fresh view, and the
 * page's bag island hands over a view on every navigation. The view with the newest revision wins,
 * so a slow response can never overwrite a newer one.
 */

let current: CartView | null = null;
let drawerOpen = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const stamp = (view: CartView): number => Number(view.revision.split(':')[0]) || 0;

export function setCartView(view: CartView): void {
  if (current && stamp(view) < stamp(current)) return;
  current = view;
  emit();
}

export function getCartView(): CartView | null {
  return current;
}

export function openCartDrawer(): void {
  drawerOpen = true;
  emit();
}

export function closeCartDrawer(): void {
  drawerOpen = false;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The bag, or null until the first view has arrived (the server renders nothing for it). */
export function useCartView(): CartView | null {
  return useSyncExternalStore(subscribe, getCartView, () => null);
}

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => drawerOpen,
    () => false,
  );
}

/** Test helper. */
export function resetCartStore(): void {
  current = null;
  drawerOpen = false;
  emit();
}
