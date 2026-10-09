import { db } from '@/lib/db';
import { money, serialize, type SerializedMoney } from '@/lib/money';
import { getOrderProfit } from '@/modules/finance/service';
import { listRefundsOfOrder } from '@/modules/payments/refunds';
import { getReturnSettings } from '@/modules/settings/service';
import {
  listActiveShipments,
  listCourierOptions,
  listForOrder,
  listPackagingProfiles,
} from '@/modules/shipping/shipments';
import type { AdminOrderDetail } from './admin-types';
import * as repo from './repository';
import { STATUS_LABEL, isAwaitingVerification, type OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

/**
 * Everything the admin order page shows (6.3): items, customer, timeline, notes, payments, parcels,
 * refunds, returns, verification history and, for staff who may see cost, the cost and profit
 * breakdown. Reads only. What staff may DO is decided by the actions, not by this model.
 */

const COURIER_LABEL: Record<string, string> = {
  manual: 'Manual',
  pathao: 'Pathao',
  steadfast: 'Steadfast',
};

export async function getOrderForAdmin(
  id: string,
  options: { includeCost: boolean; includeShippingCharges?: boolean },
): Promise<AdminOrderDetail | null> {
  const order = await repo.findById(db, id);
  if (!order) return null;
  const [events, attempts, refunds, returns, shipments, settings, counts] = await Promise.all([
    repo.findEvents(db, id),
    repo.listAttempts(db, id),
    listRefundsOfOrder(db, id),
    repo.returnsWithItems(db, id),
    listForOrder(db, id),
    getReturnSettings(db),
    repo.replacementCounts(db, id),
  ]);
  const profit = options.includeCost ? await getOrderProfit(id) : null;
  const packaging = options.includeCost ? await listPackagingProfiles(db) : [];

  const actorIds = [
    ...new Set(events.map((event) => event.actorId).filter((x): x is string => !!x)),
  ];
  const names = new Map(
    (await repo.staffNames(db, actorIds)).map((member) => [member.id, member.user.name]),
  );
  const status = order.status as OrderStatus;
  const cur = order.currency;
  const at = (minor: bigint, currency = cur) => serialize(money(minor, currency));
  const openRefunds = refunds
    .filter((refund) => refund.status === 'requested')
    .reduce((sum, refund) => sum + refund.amountMinor, 0n);
  const refundable = order.paidMinor - order.refundedMinor - openRefunds;
  const endsAt = order.deliveredAt
    ? new Date(order.deliveredAt.getTime() + settings.windowDays * 24 * 3600 * 1000)
    : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    statusLabel: STATUS_LABEL[status],
    awaitingVerification: isAwaitingVerification(status),
    channel: order.channel,
    placedAt: order.placedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    customer: { name: order.customerName, phone: order.phone, email: order.email },
    address: order.shippingAddress as unknown as ShippingAddressSnapshot,
    delivery: order.shippingMethod as unknown as ShippingMethodSnapshot,
    customerNote: order.customerNote,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.titleSnapshot,
      variantLabel: item.variantTitleSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      quantityReturned: item.quantityReturned,
      unitPrice: at(item.unitPriceMinor),
      unitCost: options.includeCost ? at(item.unitCostMinor) : null,
      lineTotal: at(item.totalMinor),
      imageUrl: item.imageSnapshot,
      isReplacement: item.replacementOfItemId !== null,
    })),
    subtotal: at(order.subtotalMinor),
    discount: at(order.discountMinor),
    shipping: at(order.shippingChargedMinor),
    total: at(order.totalMinor),
    paid: at(order.paidMinor),
    refunded: at(order.refundedMinor),
    refundable: at(refundable < 0n ? 0n : refundable),
    paymentStatus: order.paymentStatus,
    payments: order.payments.map((payment) => ({
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      amount: at(payment.amountMinor, payment.currency),
      createdAt: payment.createdAt.toISOString(),
    })),
    refunds: refunds.map((refund) => ({
      id: refund.id,
      amount: at(refund.amountMinor, refund.currency),
      status: refund.status,
      method: refund.method,
      reason: refund.reason,
      note: refund.note,
      createdAt: refund.createdAt.toISOString(),
      processedAt: refund.processedAt?.toISOString() ?? null,
    })),
    returns: returns.map((found) => ({
      id: found.id,
      returnNumber: found.returnNumber,
      type: found.type,
      status: found.status,
      resolution: found.resolution,
      customerNote: found.customerNote,
      staffNote: found.staffNote,
      createdAt: found.createdAt.toISOString(),
      returnShipping: options.includeCost
        ? at(found.returnShippingCostMinor, found.currency)
        : null,
      value: at(
        found.items.reduce(
          (sum, item) => sum + item.orderItem.unitPriceMinor * BigInt(item.quantity),
          0n,
        ),
        found.currency,
      ),
      items: found.items.map((item) => ({
        id: item.id,
        title: item.orderItem.titleSnapshot,
        variantLabel: item.orderItem.variantTitleSnapshot,
        quantity: item.quantity,
        reason: item.reason,
        condition: item.condition,
        exchangeVariantLabel: item.exchangeVariantId ? 'Replacement chosen' : null,
      })),
    })),
    shipments: shipments.map((shipment) => ({
      id: shipment.id,
      kind: shipment.kind,
      courier: shipment.courier,
      courierLabel: COURIER_LABEL[shipment.courier] ?? shipment.courier,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      cost:
        options.includeCost || options.includeShippingCharges
          ? at(shipment.costMinor, shipment.currency)
          : null,
      codFee:
        options.includeCost || options.includeShippingCharges
          ? at(shipment.codFeeMinor, shipment.currency)
          : null,
      codAmount: at(shipment.codAmountMinor, shipment.currency),
      bookedAt: shipment.bookedAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      events: shipment.events.map((event) => ({
        status: event.status,
        description: event.description,
        at: event.occurredAt.toISOString(),
      })),
    })),
    attempts: attempts.map((attempt) => ({
      at: attempt.createdAt.toISOString(),
      staffName: attempt.staff.user.name,
      channel: attempt.channel,
      outcome: attempt.outcome,
      note: attempt.note,
    })),
    events: events.map((event) => {
      const payload = event.payload as { note?: string | null; reason?: string | null } | null;
      return {
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        createdAt: event.createdAt.toISOString(),
        note: payload?.note ?? null,
        staffName: event.actorId ? (names.get(event.actorId) ?? null) : null,
      };
    }),
    riskScore: order.riskScore,
    riskFlags: order.riskFlags,
    profit,
    couriers: listCourierOptions(),
    packaging: packaging
      .filter((profile) => profile.active)
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        cost: at(profile.costMinor, profile.currency),
        isDefault: profile.isDefault,
      })),
    returnWindow: {
      days: settings.windowDays,
      endsAt: endsAt?.toISOString() ?? null,
      open: endsAt !== null && endsAt.getTime() > Date.now() && status === 'delivered',
    },
    pendingReplacements: Math.max(0, counts.exchanged - counts.shipped),
  };
}

// ---------------------------------------------------------------------------------------------
// Fulfilment board (shipping screen)
// ---------------------------------------------------------------------------------------------

export interface BoardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  confirmedAt: string | null;
  total: SerializedMoney;
  area: string;
}

export interface BoardParcel {
  shipmentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  courier: string;
  trackingNumber: string | null;
  status: string;
  bookedAt: string | null;
}

/** Orders waiting for a parcel, parcels on their way, and parcels that failed or must come back. */
export async function getFulfilmentBoard() {
  const [ready, parcels, failed] = await Promise.all([
    repo.listOrders(db, {
      where: { status: { in: ['confirmed', 'processing'] } },
      skip: 0,
      take: 100,
    }),
    listActiveShipments(db, 100),
    repo.listOrders(db, { where: { status: 'delivery_failed' }, skip: 0, take: 100 }),
  ]);
  const areaOf = async (ids: string[]) => {
    const rows = await repo.shippingAreas(db, ids);
    return new Map(rows.map((row) => [row.id, row.area]));
  };
  const areas = await areaOf([...ready, ...failed].map((row) => row.id));
  const toBoard = (row: (typeof ready)[number]): BoardOrder => ({
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    phone: row.phone,
    status: row.status as OrderStatus,
    confirmedAt: null,
    total: serialize(money(row.totalMinor, row.currency)),
    area: areas.get(row.id) ?? '',
  });
  return {
    ready: ready.map(toBoard),
    failed: failed.map(toBoard),
    parcels: parcels
      .filter((parcel) => parcel.order.status === 'shipped')
      .map((parcel): BoardParcel => ({
        shipmentId: parcel.id,
        orderId: parcel.orderId,
        orderNumber: parcel.order.orderNumber,
        customerName: parcel.order.customerName,
        courier: parcel.courierName ?? parcel.courier,
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        bookedAt: parcel.bookedAt?.toISOString() ?? null,
      })),
  };
}

/** Labels for the approvals screen: order numbers and staff names by id. */
export async function approvalLabels(orderIds: readonly string[], staffIds: readonly string[]) {
  const [orders, staff] = await Promise.all([
    repo.orderNumbers(db, orderIds),
    repo.staffNames(db, staffIds),
  ]);
  return {
    orders: new Map(orders.map((row) => [row.id, row.orderNumber])),
    staff: new Map(staff.map((row) => [row.id, row.user.name])),
  };
}
