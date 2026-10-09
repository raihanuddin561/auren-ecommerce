import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';
import { listForOrder } from '@/modules/shipping/shipments';
import type { OrderDocument } from './documents';
import { CHANNEL_LABEL } from './schemas';
import * as repo from './repository';
import type { OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

/**
 * The data behind an invoice or a packing slip. Documents exist only for orders a person has
 * confirmed: an order still being verified can change, so nothing is printed for it.
 */

const NOT_CONFIRMED: readonly OrderStatus[] = [
  'pending_payment',
  'payment_expired',
  'placed',
  'under_verification',
  'on_hold',
  'cancelled',
];

export const MAX_BATCH = 50;

export async function loadOrderDocuments(orderIds: readonly string[]): Promise<OrderDocument[]> {
  const documents: OrderDocument[] = [];
  for (const id of orderIds) {
    const order = await repo.findById(db, id);
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
    if (NOT_CONFIRMED.includes(order.status as OrderStatus)) {
      throw new DomainError(
        'CONFLICT',
        `${order.orderNumber} is not confirmed yet. Documents are printed for confirmed orders only.`,
      );
    }
    const shipments = await listForOrder(db, id);
    const parcel = [...shipments].reverse().find((shipment) => shipment.kind === 'outbound');
    const at = (minor: bigint) => formatPriceText(money(minor, order.currency));
    const address = order.shippingAddress as unknown as ShippingAddressSnapshot;
    const method = order.shippingMethod as unknown as ShippingMethodSnapshot;
    const due = order.totalMinor - order.paidMinor;
    const stillToCollect = due > 0n && order.status !== 'delivered' && order.status !== 'completed';
    documents.push({
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      channel: CHANNEL_LABEL[order.channel] ?? order.channel,
      customer: { name: order.customerName, phone: order.phone, email: order.email },
      addressLines: [
        address.line1,
        address.line2,
        [address.area, address.thana.name].filter(Boolean).join(', '),
        [address.district.name, address.division.name, address.postalCode]
          .filter(Boolean)
          .join(', '),
      ].filter((line): line is string => Boolean(line && line.trim())),
      deliveryLabel: `${method.rateName} (${method.zoneName})`,
      paymentLabel: order.payments[0]?.provider === 'cod' ? 'Cash on delivery' : 'Paid online',
      collectOnDelivery: stillToCollect ? at(due) : null,
      note: order.customerNote,
      courier: parcel ? (parcel.courierName ?? parcel.courier) : null,
      trackingNumber: parcel?.trackingNumber ?? null,
      lines: order.items.map((item) => ({
        sku: item.skuSnapshot,
        title: item.titleSnapshot,
        variantLabel: item.variantTitleSnapshot,
        quantity: item.quantity,
        unitPrice: at(item.unitPriceMinor),
        lineTotal: at(item.totalMinor),
        replacement: item.replacementOfItemId !== null,
      })),
      totals: {
        subtotal: at(order.subtotalMinor),
        discount: order.discountMinor > 0n ? `-${at(order.discountMinor)}` : null,
        shipping:
          order.shippingChargedMinor === 0n ? 'Complimentary' : at(order.shippingChargedMinor),
        total: at(order.totalMinor),
        paid: order.paidMinor > 0n ? at(order.paidMinor) : null,
        refunded: order.refundedMinor > 0n ? `-${at(order.refundedMinor)}` : null,
        due: stillToCollect ? at(due) : null,
      },
    });
  }
  return documents;
}
