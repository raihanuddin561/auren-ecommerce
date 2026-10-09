import { db } from '@/lib/db';
import * as catalog from '@/modules/catalog/service';
import * as inventory from '@/modules/inventory/service';
import { getReturnSettings } from '@/modules/settings/service';
import * as repo from './repository';
import type { OrderStatus } from './timeline';
import type { CustomerOrderView, ReturnOffer } from './types';

/**
 * What the order page shows beyond the order itself: where the parcel is, the dated steps in plain
 * words, the customer's returns, and whether they can still ask for one. Only customer-safe facts:
 * internal notes, claims, attempts and costs never appear here.
 */

type Extras = Pick<CustomerOrderView, 'parcel' | 'updates' | 'returns' | 'returnOffer'>;

const PARCEL_LABEL: Record<string, string> = {
  pending: 'Preparing',
  booked: 'Handed to the courier',
  picked_up: 'Picked up',
  in_transit: 'On its way',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Delivery attempt unsuccessful',
  returned: 'On its way back to us',
};

const RETURN_LABEL: Record<string, string> = {
  requested: 'We are reviewing it',
  approved: 'Approved: please send the items back',
  rejected: 'Not accepted',
  in_transit: 'On its way back',
  received: 'We have it and are checking it',
  inspected: 'Being settled',
  refunded: 'Refunded',
  exchanged: 'Exchanged',
  closed: 'Closed',
};

const UPDATE_LABEL: Record<string, string | ((to: string | null) => string | null)> = {
  placed: 'Order placed',
  status_changed: (to) =>
    to === 'confirmed' ? 'Confirmed by our team' : to === 'cancelled' ? 'Order cancelled' : null,
  order_edited: 'Order updated as we agreed',
  shipped: 'Handed to the courier',
  delivered: 'Delivered',
  delivery_failed: 'Delivery attempt unsuccessful',
  refund: 'Refund sent',
  return_requested: 'Return requested',
  return_approved: 'Return approved',
  return_received: 'Return received',
  returned: 'Return checked',
  replacement_shipped: 'Replacement sent',
  completed: 'Order complete',
};

export async function loadCustomerExtras(
  orderId: string,
  status: OrderStatus,
  deliveredAt: Date | null,
): Promise<Extras> {
  const [events, parcel, returns, settings, spoken] = await Promise.all([
    repo.customerVisibleEvents(db, orderId),
    repo.latestOutboundParcel(db, orderId),
    repo.returnsForCustomer(db, orderId),
    getReturnSettings(db),
    repo.unitsSpokenFor(db, orderId),
  ]);

  const updates = events.flatMap((event) => {
    const entry = UPDATE_LABEL[event.type];
    const label = typeof entry === 'function' ? entry(event.toStatus) : entry;
    return label ? [{ label, at: event.createdAt.toISOString() }] : [];
  });

  let returnOffer: ReturnOffer | null = null;
  const endsAt = deliveredAt
    ? new Date(deliveredAt.getTime() + settings.windowDays * 24 * 3600 * 1000)
    : null;
  const openReturn = returns.some((found) =>
    ['requested', 'approved', 'in_transit', 'received', 'inspected'].includes(found.status),
  );
  if (status === 'delivered' && endsAt && endsAt.getTime() > Date.now() && !openReturn) {
    const lines = (await repo.itemsWithVariant(db, orderId)).filter(
      (item) => item.replacementOfItemId === null,
    );
    const items: ReturnOffer['items'] = [];
    for (const line of lines) {
      const maxQuantity = line.quantity - line.quantityReturned - (spoken.get(line.id) ?? 0);
      if (maxQuantity < 1) continue;
      const ids = await catalog.liveVariantIdsOfProduct(db, line.productId);
      const [variants, stock] = await Promise.all([
        catalog.getSellableVariants(db, ids),
        inventory.getAvailability(ids),
      ]);
      items.push({
        orderItemId: line.id,
        title: line.titleSnapshot,
        variantLabel: line.variantTitleSnapshot,
        maxQuantity,
        alternatives: ids.flatMap((variantId) => {
          const variant = variants.get(variantId);
          if (
            !variant?.sellable ||
            variant.avgCostMinor <= 0n ||
            variantId === line.variantId ||
            variant.priceMinor !== line.unitPriceMinor ||
            (stock.get(variantId)?.available ?? 0) < 1
          ) {
            return [];
          }
          return [{ variantId, label: variant.optionsLabel || variant.productTitle }];
        }),
      });
    }
    if (items.length > 0) {
      returnOffer = { windowDays: settings.windowDays, endsAt: endsAt.toISOString(), items };
    }
  }

  return {
    parcel: parcel
      ? {
          courier: parcel.courierName ?? (parcel.courier === 'manual' ? 'Courier' : parcel.courier),
          trackingNumber: parcel.trackingNumber,
          statusLabel: PARCEL_LABEL[parcel.status] ?? 'On its way',
        }
      : null,
    updates,
    returns: returns.map((found) => ({
      returnNumber: found.returnNumber,
      type: found.type,
      statusLabel: RETURN_LABEL[found.status] ?? found.status,
    })),
    returnOffer,
  };
}
