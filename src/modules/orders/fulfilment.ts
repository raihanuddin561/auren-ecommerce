import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import * as finance from '@/modules/finance/service';
import { addManualCostLine } from '@/modules/finance/service';
import * as inventory from '@/modules/inventory/service';
import { recordCodCollected } from '@/modules/payments/collection';
import * as shipments from '@/modules/shipping/shipments';
import {
  CourierError,
  getCourier,
  type BookingRequest,
  type CourierId,
  type ShipmentStatusId,
} from '@/modules/shipping/shipments';
import { getReturnSettings } from '@/modules/settings/service';
import * as repo from './repository';
import { transitionOrder } from './transitions';
import type { OrderStatus } from './timeline';
import type { ShippingAddressSnapshot } from './types';

/**
 * Fulfilment after confirmation: picking, handing the parcel to a courier, delivery, failed
 * delivery, return to origin, completion (ARCHITECTURE section 6). Every step goes through the
 * state machine; every cost is a cost line with its source (INV-F2); stock changes go through the
 * inventory service (INV-S3). Nothing here can confirm or cancel an order.
 *
 * Booking an API courier calls out to the network, so it happens BEFORE the database transaction
 * (INV-E1): a failed booking leaves nothing behind, and the (rare) crash between the booking and
 * the commit leaves a parcel at the courier that staff can see in the courier's own portal.
 */

export interface Fulfiller {
  /** staff_members.id */
  staffId: string;
  /** users.id */
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

type Actor = { kind: 'staff'; fulfiller: Fulfiller } | { kind: 'system' };

const actorFields = (actor: Actor) =>
  actor.kind === 'staff'
    ? { actor: 'staff' as const, staffId: actor.fulfiller.staffId }
    : { actor: 'system' as const };

async function loadLocked(tx: Tx, orderId: string) {
  if (!(await repo.lockOrder(tx, orderId))) throw new DomainError('NOT_FOUND', 'Order not found');
  const order = await repo.findById(tx, orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  return order;
}

async function auditStep(
  tx: Tx,
  actor: Actor,
  action: string,
  orderId: string,
  before: unknown,
  after: unknown,
) {
  await audit(tx, {
    actorId: actor.kind === 'staff' ? actor.fulfiller.userId : null,
    action,
    entity: 'order',
    entityId: orderId,
    before,
    after,
    ip: actor.kind === 'staff' ? (actor.fulfiller.ip ?? null) : null,
    userAgent: actor.kind === 'staff' ? (actor.fulfiller.userAgent ?? null) : null,
  });
}

// ---------------------------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------------------------

export async function startProcessing(tx: Tx, input: { orderId: string; fulfiller: Fulfiller }) {
  const order = await loadLocked(tx, input.orderId);
  if (order.status === 'processing') return { orderId: order.id, status: 'processing' as const };
  await transitionOrder(tx, {
    orderId: order.id,
    from: order.status as OrderStatus,
    to: 'processing',
    actor: 'staff',
    staffId: input.fulfiller.staffId,
    eventType: 'picking_started',
  });
  await auditStep(
    tx,
    { kind: 'staff', fulfiller: input.fulfiller },
    'order.process',
    order.id,
    {
      status: order.status,
    },
    { status: 'processing' },
  );
  return { orderId: order.id, status: 'processing' as const };
}

// ---------------------------------------------------------------------------------------------
// Handing the parcel to a courier
// ---------------------------------------------------------------------------------------------

export interface ShipOrderInput {
  orderId: string;
  courier: CourierId;
  /** Manual courier: who carries it, and the tracking number they gave. */
  courierName?: string | undefined;
  trackingNumber?: string | undefined;
  /** What the courier charges us, in minor units. An API courier's own answer wins when it gives one. */
  costMinor?: bigint | undefined;
  weightG?: number | undefined;
  note?: string | undefined;
  packagingProfileId?: string | undefined;
  fulfiller: Fulfiller;
}

const SHIPPABLE: readonly OrderStatus[] = ['confirmed', 'processing', 'delivery_failed'];

const addressLine = (address: ShippingAddressSnapshot) =>
  [
    address.line1,
    address.line2,
    address.area,
    address.thana.name,
    address.district.name,
    address.division.name,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

export async function shipOrder(input: ShipOrderInput) {
  // 1. Read and check without locks, so the courier call is not inside a transaction.
  const order = await repo.findById(db, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  if (!SHIPPABLE.includes(order.status as OrderStatus)) {
    throw new DomainError(
      'CONFLICT',
      `A parcel can be booked only for a confirmed order. This order is ${order.status.replaceAll('_', ' ')}.`,
    );
  }
  if (await shipments.findLiveOutbound(db, order.id)) {
    throw new DomainError('CONFLICT', 'A parcel is already booked for this order.');
  }
  const address = order.shippingAddress as unknown as ShippingAddressSnapshot;
  const collect = order.paymentStatus === 'paid' ? 0n : order.totalMinor - order.paidMinor;
  const request: BookingRequest = {
    orderNumber: order.orderNumber,
    recipient: { name: address.fullName, phone: order.phone, address: addressLine(address) },
    codAmountMinor: collect,
    currency: order.currency,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    weightG: input.weightG ?? null,
    note: input.note ?? null,
    ...(input.courier === 'manual'
      ? {
          manual: {
            courierName: input.courierName ?? '',
            trackingNumber: input.trackingNumber ?? '',
            costMinor: input.costMinor ?? 0n,
          },
        }
      : {}),
  };

  // 2. The courier (network) call, outside any transaction.
  const courier = getCourier(input.courier);
  let booked;
  try {
    booked = await courier.book(request);
  } catch (error) {
    if (error instanceof CourierError) {
      throw new DomainError(
        'CONFLICT',
        `${error.message}${error.retryable ? ' Please try again in a moment.' : ''} You can also hand the parcel over with the manual courier.`,
      );
    }
    throw error;
  }

  // 3. Record everything in one transaction.
  const now = new Date();
  return db.$transaction(async (tx) => {
    const locked = await loadLocked(tx, input.orderId);
    const from = locked.status as OrderStatus;
    if (!SHIPPABLE.includes(from)) {
      throw new DomainError('CONFLICT', 'This order has just been changed by someone else.');
    }
    if (await shipments.findLiveOutbound(tx, locked.id)) {
      throw new DomainError('CONFLICT', 'A parcel is already booked for this order.');
    }
    if (from === 'confirmed') {
      await transitionOrder(tx, {
        orderId: locked.id,
        from,
        to: 'processing',
        actor: 'staff',
        staffId: input.fulfiller.staffId,
        eventType: 'picking_started',
      });
    }
    const cost = booked.costMinor ?? input.costMinor ?? 0n;
    const shipment = await shipments.recordBooking(tx, {
      orderId: locked.id,
      kind: 'outbound',
      courier: input.courier,
      courierName: input.courier === 'manual' ? (input.courierName?.trim() ?? null) : null,
      trackingNumber: booked.trackingNumber,
      consignmentId: booked.consignmentId,
      codAmountMinor: collect,
      costMinor: cost,
      codFeeMinor: 0n,
      currency: locked.currency,
      weightG: input.weightG ?? null,
      labelUrl: booked.labelUrl,
      bookedBy: input.fulfiller.staffId,
      bookedAt: now,
    });
    await finance.recordCostLine(tx, {
      orderId: locked.id,
      type: 'shipping',
      amountMinor: cost,
      currency: locked.currency,
      sourceType: 'shipment',
      sourceId: shipment.id,
      note: input.courier === 'manual' ? (input.courierName ?? null) : input.courier,
      actorId: input.fulfiller.staffId,
    });

    // Packaging (6.9): the profile chosen, or the default one, once per order.
    const profile = input.packagingProfileId
      ? await shipments.findPackagingProfile(tx, input.packagingProfileId)
      : await shipments.defaultPackaging(tx);
    if (profile && profile.active) {
      await finance.recordCostLine(tx, {
        orderId: locked.id,
        type: 'packaging',
        amountMinor: profile.costMinor,
        currency: locked.currency,
        sourceType: 'packaging',
        sourceId: locked.id,
        note: profile.name,
        actorId: input.fulfiller.staffId,
      });
    }

    await transitionOrder(tx, {
      orderId: locked.id,
      from: from === 'confirmed' ? 'processing' : from,
      to: 'shipped',
      actor: 'staff',
      staffId: input.fulfiller.staffId,
      data: { shippedAt: now, fulfillmentStatus: 'fulfilled' },
      eventType: 'shipped',
      payload: {
        courier: input.courier,
        trackingNumber: booked.trackingNumber,
        ...(input.courier === 'manual' && input.courierName
          ? { courierName: input.courierName }
          : {}),
      },
    });
    await enqueueEvent(tx, {
      type: 'shipment.updated',
      aggregateType: 'order',
      aggregateId: locked.id,
      payload: { shipmentId: shipment.id, orderId: locked.id, status: 'booked' },
    });
    await auditStep(
      tx,
      { kind: 'staff', fulfiller: input.fulfiller },
      'order.ship',
      locked.id,
      { status: from },
      {
        status: 'shipped',
        courier: input.courier,
        trackingNumber: booked.trackingNumber,
        costMinor: cost.toString(),
      },
    );
    return {
      orderId: locked.id,
      shipmentId: shipment.id,
      trackingNumber: booked.trackingNumber,
      courier: input.courier,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Parcel progress: staff update the manual courier, polling updates the API couriers
// ---------------------------------------------------------------------------------------------

export interface ParcelUpdate {
  orderId: string;
  shipmentId: string;
  status: ShipmentStatusId;
  description?: string | null;
  externalId?: string | null;
  occurredAt?: Date;
  raw?: unknown;
  /** The courier's COD collection fee, when known (typed by staff at delivery). */
  codFeeMinor?: bigint | undefined;
  actor: Actor;
}

/** Applies one status report to the parcel and carries the order along (delivered, failed). */
export async function applyParcelUpdate(tx: Tx, update: ParcelUpdate) {
  const order = await loadLocked(tx, update.orderId);
  const shipment = await shipments.lockShipment(tx, update.shipmentId);
  if (!shipment || shipment.orderId !== order.id) {
    throw new DomainError('NOT_FOUND', 'Parcel not found');
  }
  const at = update.occurredAt ?? new Date();
  const stored = await shipments.applyStatus(tx, shipment, {
    status: update.status,
    description: update.description ?? null,
    occurredAt: at,
    externalId: update.externalId ?? null,
    actorId: update.actor.kind === 'staff' ? update.actor.fulfiller.staffId : null,
    raw: update.raw ?? null,
    deliveredAt: update.status === 'delivered' ? at : null,
  });
  if (!stored) return { orderId: order.id, status: order.status as OrderStatus, repeated: true };

  const from = order.status as OrderStatus;
  if (update.status === 'delivered' && (from === 'shipped' || from === 'delivery_failed')) {
    await transitionOrder(tx, {
      orderId: order.id,
      from,
      to: 'delivered',
      ...actorFields(update.actor),
      data: { deliveredAt: at },
      eventType: 'delivered',
    });
    // The cash is real now (cash on delivery): the payment succeeds and the order is paid.
    await recordCodCollected(tx, { orderId: order.id, at });
    if (update.codFeeMinor !== undefined) {
      await finance.setSourceCost(tx, {
        orderId: order.id,
        type: 'cod_fee',
        currency: order.currency,
        sourceType: 'shipment_cod_fee',
        sourceId: shipment.id,
        targetMinor: update.codFeeMinor,
        actorId: update.actor.kind === 'staff' ? update.actor.fulfiller.staffId : null,
      });
      await shipments.patchShipment(tx, shipment.id, { codFeeMinor: update.codFeeMinor });
    }
    await auditStep(
      tx,
      update.actor,
      'order.deliver',
      order.id,
      { status: from },
      { status: 'delivered' },
    );
  } else if (update.status === 'failed' && from === 'shipped') {
    await transitionOrder(tx, {
      orderId: order.id,
      from,
      to: 'delivery_failed',
      ...actorFields(update.actor),
      eventType: 'delivery_failed',
      payload: { description: update.description ?? null },
    });
    await auditStep(
      tx,
      update.actor,
      'order.delivery_failed',
      order.id,
      { status: from },
      {
        status: 'delivery_failed',
      },
    );
  } else if (update.status === 'returned' && from === 'shipped') {
    // The courier is sending it back: the order shows a failed delivery until staff receive the parcel.
    await transitionOrder(tx, {
      orderId: order.id,
      from,
      to: 'delivery_failed',
      ...actorFields(update.actor),
      eventType: 'delivery_failed',
      payload: { description: update.description ?? 'Returning to us' },
    });
  } else {
    await repo.insertEvent(tx, {
      orderId: order.id,
      type: 'parcel_update',
      actorId: update.actor.kind === 'staff' ? update.actor.fulfiller.staffId : null,
      payload: { status: update.status, description: update.description ?? null },
    });
  }
  await enqueueEvent(tx, {
    type: 'shipment.updated',
    aggregateType: 'order',
    aggregateId: order.id,
    payload: { shipmentId: shipment.id, orderId: order.id, status: update.status },
  });
  return { orderId: order.id, status: update.status, repeated: false };
}

/** Staff correct what a parcel costs or how it is tracked. A changed cost adds a correction line. */
export async function updateParcelDetails(
  tx: Tx,
  input: {
    orderId: string;
    shipmentId: string;
    courierName?: string | undefined;
    trackingNumber?: string | undefined;
    costMinor?: bigint | undefined;
    codFeeMinor?: bigint | undefined;
    fulfiller: Fulfiller;
  },
) {
  const order = await loadLocked(tx, input.orderId);
  const shipment = await shipments.lockShipment(tx, input.shipmentId);
  if (!shipment || shipment.orderId !== order.id)
    throw new DomainError('NOT_FOUND', 'Parcel not found');
  await shipments.patchShipment(tx, shipment.id, {
    ...(input.courierName !== undefined ? { courierName: input.courierName } : {}),
    ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
    ...(input.costMinor !== undefined ? { costMinor: input.costMinor } : {}),
    ...(input.codFeeMinor !== undefined ? { codFeeMinor: input.codFeeMinor } : {}),
  });
  if (input.costMinor !== undefined) {
    await finance.setSourceCost(tx, {
      orderId: order.id,
      type: 'shipping',
      currency: order.currency,
      sourceType: 'shipment',
      sourceId: shipment.id,
      targetMinor: input.costMinor,
      actorId: input.fulfiller.staffId,
    });
  }
  if (input.codFeeMinor !== undefined) {
    await finance.setSourceCost(tx, {
      orderId: order.id,
      type: 'cod_fee',
      currency: order.currency,
      sourceType: 'shipment_cod_fee',
      sourceId: shipment.id,
      targetMinor: input.codFeeMinor,
      actorId: input.fulfiller.staffId,
    });
  }
  await auditStep(
    tx,
    { kind: 'staff', fulfiller: input.fulfiller },
    'order.shipment_update',
    order.id,
    {
      costMinor: shipment.costMinor.toString(),
      trackingNumber: shipment.trackingNumber,
    },
    {
      costMinor: (input.costMinor ?? shipment.costMinor).toString(),
      trackingNumber: input.trackingNumber ?? shipment.trackingNumber,
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Return to origin (6.11)
// ---------------------------------------------------------------------------------------------

export interface RtoInput {
  orderId: string;
  /** Whether the goods came back fit to sell. */
  condition: 'resellable' | 'damaged';
  /** What it cost us to bring it back (return courier fee) and any other loss, in minor units. */
  lossMinor: bigint;
  note?: string | undefined;
  fulfiller: Fulfiller;
}

/** A phone with this many returns to origin in 90 days is flagged as a repeat (it then cannot order online). */
export const REPEAT_RTO_THRESHOLD = 2;

/**
 * The parcel is back with us: restock when it is fit to sell, record the loss, and flag the phone.
 * The first return only raises a non-blocking note on the phone; a repeat blocks online orders.
 */
export async function receiveReturnToOrigin(tx: Tx, input: RtoInput) {
  const order = await loadLocked(tx, input.orderId);
  const from = order.status as OrderStatus;
  if (from === 'returned_to_origin') {
    return { orderId: order.id, status: from, tags: [] as string[], repeat: false };
  }
  if (from !== 'delivery_failed' && from !== 'shipped') {
    throw new DomainError(
      'CONFLICT',
      'Only a parcel that was shipped and could not be delivered can come back to origin.',
    );
  }
  const shipment = await shipments.findLatestOutbound(tx, order.id);
  const lockedShipment = shipment ? await shipments.lockShipment(tx, shipment.id) : null;
  if (from === 'shipped') {
    await transitionOrder(tx, {
      orderId: order.id,
      from,
      to: 'delivery_failed',
      actor: 'staff',
      staffId: input.fulfiller.staffId,
      eventType: 'delivery_failed',
    });
  }
  if (lockedShipment) {
    await shipments.applyStatus(tx, lockedShipment, {
      status: 'returned',
      description: 'Parcel received back',
      actorId: input.fulfiller.staffId,
    });
  }

  let tags: string[] = [];
  if (input.condition === 'resellable') {
    const net = await inventory.netSoldStock(tx, 'order', order.id);
    if (net.size > 0) {
      const effect = await inventory.restock(tx, {
        referenceType: 'order',
        referenceId: order.id,
        lines: [...net].map(([variantId, quantity]) => ({ variantId, quantity })),
        reason: 'rto_restock',
        actorId: input.fulfiller.userId,
      });
      tags = effect.tags;
    }
  }
  await finance.recordCostLine(tx, {
    orderId: order.id,
    type: 'rto_loss',
    amountMinor: input.lossMinor,
    currency: order.currency,
    sourceType: 'rto',
    sourceId: order.id,
    note: input.note ?? (input.condition === 'damaged' ? 'Goods damaged on return' : null),
    actorId: input.fulfiller.staffId,
  });

  const priorReturns = await repo.countReturnsToOrigin(tx, order.phone, order.id, 90);
  const repeat = priorReturns + 1 >= REPEAT_RTO_THRESHOLD;
  await repo.createRiskFlag(tx, {
    phone: order.phone,
    userId: order.userId,
    type: repeat ? 'repeat_rto' : 'manual',
    note: `Returned to origin: ${order.orderNumber}${repeat ? ' (repeat)' : ''}`,
    createdBy: input.fulfiller.staffId,
  });

  await transitionOrder(tx, {
    orderId: order.id,
    from: 'delivery_failed',
    to: 'returned_to_origin',
    actor: 'staff',
    staffId: input.fulfiller.staffId,
    data: { returnedToOriginAt: new Date(), fulfillmentStatus: 'returned' },
    eventType: 'returned_to_origin',
    payload: { condition: input.condition, restocked: input.condition === 'resellable' },
  });
  await auditStep(
    tx,
    { kind: 'staff', fulfiller: input.fulfiller },
    'order.rto',
    order.id,
    { status: 'delivery_failed' },
    {
      status: 'returned_to_origin',
      condition: input.condition,
      lossMinor: input.lossMinor.toString(),
      phoneFlag: repeat ? 'repeat_rto' : 'manual',
    },
  );
  return { orderId: order.id, status: 'returned_to_origin' as const, tags, repeat };
}

// ---------------------------------------------------------------------------------------------
// Completion (a system step: it only moves an order to `completed`)
// ---------------------------------------------------------------------------------------------

/**
 * Orders delivered longer ago than the return window, with no return open, become `completed`.
 * It is an automatic, harmless step: it never touches money or stock, and cannot confirm or cancel.
 */
export async function completeOrdersPastReturnWindow(
  now: Date = new Date(),
): Promise<{ completed: number }> {
  const { windowDays } = await getReturnSettings(db);
  const cutoff = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  const candidates = await repo.listCompletable(db, cutoff);
  let completed = 0;
  for (const candidate of candidates) {
    await db.$transaction(async (tx) => {
      const order = await loadLocked(tx, candidate.id);
      if (order.status !== 'delivered' || !order.deliveredAt || order.deliveredAt > cutoff) return;
      if (await repo.hasOpenReturn(tx, order.id)) return;
      await transitionOrder(tx, {
        orderId: order.id,
        from: 'delivered',
        to: 'completed',
        actor: 'system',
        data: { completedAt: now },
        eventType: 'completed',
      });
      completed += 1;
    });
  }
  return { completed };
}

// ---------------------------------------------------------------------------------------------
// Polling the courier APIs (a system step: it only reports parcel progress)
// ---------------------------------------------------------------------------------------------

/**
 * Asks each API courier where its parcels are and applies what it says. The network calls happen
 * outside any transaction; each update is stored once (the courier's update id), so polling the
 * same update again changes nothing. A courier that is down is skipped and tried again next run.
 */
export async function pollParcels(limit = 50): Promise<{ checked: number; applied: number }> {
  const parcels = await shipments.listPollable(db, limit);
  let applied = 0;
  for (const parcel of parcels) {
    if (!parcel.consignmentId) continue;
    let updates;
    try {
      const courier = getCourier(parcel.courier);
      if (!courier.fetchUpdates) continue;
      updates = await courier.fetchUpdates({
        consignmentId: parcel.consignmentId,
        trackingNumber: parcel.trackingNumber ?? parcel.consignmentId,
      });
    } catch {
      // Not configured any more, or the courier is down: try again next time.
      continue;
    }
    for (const update of updates) {
      try {
        const result = await db.$transaction((tx) =>
          applyParcelUpdate(tx, {
            orderId: parcel.orderId,
            shipmentId: parcel.id,
            status: update.status,
            description: update.description,
            externalId: update.externalId,
            occurredAt: update.occurredAt,
            raw: update.raw,
            actor: { kind: 'system' },
          }),
        );
        if (!result.repeated) applied += 1;
      } catch (error) {
        // One bad update must not stop the others: it is logged and tried again on the next run.
        logger.warn({ err: error, shipmentId: parcel.id }, 'courier update could not be applied');
      }
    }
  }
  return { checked: parcels.length, applied };
}

// ---------------------------------------------------------------------------------------------
// Replacement parcel for an exchange (6.12)
// ---------------------------------------------------------------------------------------------

/**
 * Sends the replacement of an exchange. The stock already left when the exchange was resolved; this
 * records who carries it and what it costs (the manual courier). The order's status does not move:
 * its customer-facing story ended when the exchange was agreed.
 */
export async function shipReplacement(
  tx: Tx,
  input: {
    orderId: string;
    courierName: string;
    trackingNumber: string;
    costMinor: bigint;
    fulfiller: Fulfiller;
  },
) {
  const order = await loadLocked(tx, input.orderId);
  const counts = await repo.replacementCounts(tx, order.id);
  if (counts.shipped >= counts.exchanged) {
    throw new DomainError('CONFLICT', 'There is no exchange waiting for a replacement parcel.');
  }
  const shipment = await shipments.recordBooking(tx, {
    orderId: order.id,
    kind: 'replacement',
    courier: 'manual',
    courierName: input.courierName.trim(),
    trackingNumber: input.trackingNumber.trim(),
    consignmentId: null,
    codAmountMinor: 0n,
    costMinor: input.costMinor,
    codFeeMinor: 0n,
    currency: order.currency,
    weightG: null,
    labelUrl: null,
    bookedBy: input.fulfiller.staffId,
    bookedAt: new Date(),
  });
  await finance.recordCostLine(tx, {
    orderId: order.id,
    type: 'shipping',
    amountMinor: input.costMinor,
    currency: order.currency,
    sourceType: 'shipment',
    sourceId: shipment.id,
    note: `Replacement: ${input.courierName.trim()}`,
    actorId: input.fulfiller.staffId,
  });
  await repo.insertEvent(tx, {
    orderId: order.id,
    type: 'replacement_shipped',
    actorId: input.fulfiller.staffId,
    payload: { trackingNumber: input.trackingNumber.trim(), courierName: input.courierName.trim() },
  });
  await enqueueEvent(tx, {
    type: 'shipment.updated',
    aggregateType: 'order',
    aggregateId: order.id,
    payload: { shipmentId: shipment.id, orderId: order.id, status: 'booked' },
  });
  await auditStep(
    tx,
    { kind: 'staff', fulfiller: input.fulfiller },
    'order.ship_replacement',
    order.id,
    null,
    {
      trackingNumber: input.trackingNumber.trim(),
      costMinor: input.costMinor.toString(),
    },
  );
  return { orderId: order.id, shipmentId: shipment.id };
}

// Entry points for the actions: one transaction each. The caller checked the permission. --------

export const startProcessingStaff = (input: Parameters<typeof startProcessing>[1]) =>
  db.$transaction((tx) => startProcessing(tx, input));
export const applyParcelUpdateStaff = (input: ParcelUpdate) =>
  db.$transaction((tx) => applyParcelUpdate(tx, input));
export const updateParcelDetailsStaff = (input: Parameters<typeof updateParcelDetails>[1]) =>
  db.$transaction((tx) => updateParcelDetails(tx, input));
export const receiveReturnToOriginStaff = (input: RtoInput) =>
  db.$transaction((tx) => receiveReturnToOrigin(tx, input));

/** Adds a cost nothing records automatically to an order. Audited by the finance service. */
export const addOrderCost = addManualCostLine;
