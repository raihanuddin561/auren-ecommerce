import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

/** Data access for parcels (shipments) and their status updates. No business rules here. */

export const insertShipment = (tx: Tx, data: Prisma.ShipmentUncheckedCreateInput) =>
  tx.shipment.create({ data });

/** Locks one parcel for the transaction and reads it. */
export async function lockShipment(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.shipment.findUnique({ where: { id } });
}

export const patchShipment = (tx: Tx, id: string, data: Prisma.ShipmentUncheckedUpdateInput) =>
  tx.shipment.update({ where: { id }, data });

export const listShipmentsOfOrder = (tx: Tx, orderId: string) =>
  tx.shipment.findMany({
    where: { orderId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { events: { orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }] } },
  });

export const findLiveOutbound = (tx: Tx, orderId: string) =>
  tx.shipment.findFirst({
    where: { orderId, kind: 'outbound', status: { notIn: ['failed', 'returned'] } },
  });

/**
 * Stores one status update. An update that carries the courier's own id is stored once: a second
 * poll that returns the same update changes nothing. Returns whether a row was written.
 */
export async function insertShipmentEvent(
  tx: Tx,
  data: {
    shipmentId: string;
    status: Prisma.ShipmentEventUncheckedCreateInput['status'];
    description: string | null;
    occurredAt: Date;
    externalId: string | null;
    actorId: string | null;
    raw: unknown;
  },
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO shipment_events
      (id, shipment_id, status, description, occurred_at, external_id, actor_id, raw)
    VALUES
      (${randomUUID()}::uuid, ${data.shipmentId}::uuid, ${data.status}::shipment_status,
       ${data.description}, ${data.occurredAt}, ${data.externalId}, ${data.actorId}::uuid,
       ${data.raw === null || data.raw === undefined ? null : JSON.stringify(data.raw)}::jsonb)
    ON CONFLICT (shipment_id, external_id) DO NOTHING
    RETURNING id`;
  return rows.length === 1;
}

/** Parcels booked through a courier API that are still on their way (for polling). */
export const listPollable = (tx: Tx, limit: number) =>
  tx.shipment.findMany({
    where: {
      courier: { in: ['pathao', 'steadfast'] },
      consignmentId: { not: null },
      status: { in: ['booked', 'picked_up', 'in_transit', 'out_for_delivery'] },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, orderId: true, courier: true, consignmentId: true, trackingNumber: true },
  });

export const listActiveShipments = (tx: Tx, take: number) =>
  tx.shipment.findMany({
    where: { status: { in: ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'failed'] } },
    orderBy: { bookedAt: 'asc' },
    take,
    include: {
      order: { select: { orderNumber: true, customerName: true, phone: true, status: true } },
    },
  });

// Packaging profiles ------------------------------------------------------------------------

export const listPackagingProfiles = (tx: Tx) =>
  tx.packagingProfile.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });

export const findPackagingProfile = (tx: Tx, id: string) =>
  tx.packagingProfile.findUnique({ where: { id } });

export const findDefaultPackaging = (tx: Tx) =>
  tx.packagingProfile.findFirst({ where: { isDefault: true, active: true } });

export const insertPackagingProfile = (tx: Tx, data: Prisma.PackagingProfileUncheckedCreateInput) =>
  tx.packagingProfile.create({ data });

export const patchPackagingProfile = (
  tx: Tx,
  id: string,
  data: Prisma.PackagingProfileUncheckedUpdateInput,
) => tx.packagingProfile.update({ where: { id }, data });

export const clearDefaultPackaging = (tx: Tx) =>
  tx.packagingProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });

/** The most recent outbound parcel of an order, whatever its status. */
export const findLatestOutbound = (tx: Tx, orderId: string) =>
  tx.shipment.findFirst({ where: { orderId, kind: 'outbound' }, orderBy: { createdAt: 'desc' } });
