import type { SerializedMoney } from '@/lib/money';
import type { OrderStatus, Timeline } from './timeline';

/** Snapshot of where an order is delivered, stored on the order. */
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  division: { id: string; name: string };
  district: { id: string; name: string };
  thana: { id: string | null; name: string };
  area: string;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  country: 'BD';
}

/** Snapshot of the delivery method chosen at checkout. Amounts are minor units as text. */
export interface ShippingMethodSnapshot {
  zoneId: string;
  zoneName: string;
  rateId: string;
  rateName: string;
  listedMinor: string;
  chargedMinor: string;
  freeOverMinor: string | null;
  free: boolean;
  minDays: number;
  maxDays: number;
}

export interface OrderItemView {
  title: string;
  variantLabel: string;
  quantity: number;
  unitPrice: SerializedMoney;
  lineTotal: SerializedMoney;
  imageUrl: string | null;
  productSlug?: string;
}

/** The full order page for the customer (after the second factor). */
export interface CustomerOrderView {
  orderNumber: string;
  firstName: string;
  status: OrderStatus;
  statusLabel: string;
  timeline: Timeline;
  placedAt: string;
  items: OrderItemView[];
  subtotal: SerializedMoney;
  discount: SerializedMoney;
  shipping: SerializedMoney;
  total: SerializedMoney;
  address: { name: string; lines: string[] };
  delivery: { zoneName: string; rateName: string; eta: string };
  payment: {
    label: string;
    status: 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  };
  /** Masked, for "we sent a confirmation to j***@gmail.com". Null when no email was given. */
  emailMasked: string | null;
  /** The parcel, once it has been handed to a courier. */
  parcel: { courier: string; trackingNumber: string | null; statusLabel: string } | null;
  /** Dated steps of the order in the customer's words (never internal notes). */
  updates: Array<{ label: string; at: string }>;
  returns: Array<{ returnNumber: string; type: 'return' | 'exchange'; statusLabel: string }>;
  /** Set while the customer can still ask for a return or an exchange. */
  returnOffer: ReturnOffer | null;
}

export interface ReturnOffer {
  windowDays: number;
  endsAt: string;
  items: Array<{
    orderItemId: string;
    title: string;
    variantLabel: string;
    maxQuantity: number;
    /** Other sizes or colours of the same piece at the same price that are in stock. */
    alternatives: Array<{ variantId: string; label: string }>;
  }>;
}

/** What an order number plus a matching phone or email shows: the status and nothing else. */
export interface MinimalOrderView {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  timeline: Timeline;
  placedAt: string;
}

export type PlacedOrder = {
  orderId: string;
  orderNumber: string;
  /** Cache tags to invalidate: the stock of the variants sold. */
  tags: string[];
};
