'use client';

import { useEffect } from 'react';

/**
 * The browser OrderPlaced event (ARCHITECTURE 6.1). Today it is a hook only: it raises a DOM event
 * and pushes to a data layer if a pixel or tag manager has installed one, once per order in this
 * tab. The server-side Purchase event is sent at confirmation, not here.
 */
export interface OrderPlacedDetail {
  orderNumber: string;
  /** Minor units as text; never parsed as a number. */
  valueMinor: string;
  currency: string;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function OrderPlacedEvent(detail: OrderPlacedDetail) {
  const { orderNumber, valueMinor, currency } = detail;
  useEffect(() => {
    const key = `auren:order-placed:${orderNumber}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Without storage the event may repeat on refresh; that is acceptable for a hook.
    }
    window.dispatchEvent(
      new CustomEvent<OrderPlacedDetail>('auren:order-placed', {
        detail: { orderNumber, valueMinor, currency },
      }),
    );
    window.dataLayer?.push({ event: 'OrderPlaced', orderNumber, valueMinor, currency });
  }, [orderNumber, valueMinor, currency]);
  return null;
}
