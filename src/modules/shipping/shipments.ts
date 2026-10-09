import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { fromDecimalString } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as repo from './shipments-repository';
import type { CourierId, ShipmentStatusId } from './couriers/types';

/**
 * Parcels (6.7 to 6.9). This service stores what a courier or a staff member reports: the booking,
 * every status update, the courier cost. The order lifecycle that follows from a status is decided
 * by the fulfilment service in the orders module, which calls this one.
 */

export interface NewShipment {
  orderId: string;
  kind: 'outbound' | 'replacement';
  courier: CourierId;
  courierName: string | null;
  trackingNumber: string;
  consignmentId: string | null;
  codAmountMinor: bigint;
  costMinor: bigint;
  codFeeMinor: bigint;
  currency: string;
  weightG: number | null;
  labelUrl: string | null;
  bookedBy: string | null;
  bookedAt: Date;
}

export async function recordBooking(tx: Tx, input: NewShipment) {
  const shipment = await repo.insertShipment(tx, { ...input, status: 'booked' });
  await repo.insertShipmentEvent(tx, {
    shipmentId: shipment.id,
    status: 'booked',
    description: input.courierName
      ? `Handed to ${input.courierName}`
      : `Booked with ${input.courier}`,
    occurredAt: input.bookedAt,
    externalId: null,
    actorId: input.bookedBy,
    raw: null,
  });
  return shipment;
}

export const lockShipment = (tx: Tx, id: string) => repo.lockShipment(tx, id);
export const listForOrder = (tx: Tx, orderId: string) => repo.listShipmentsOfOrder(tx, orderId);
export const findLiveOutbound = (tx: Tx, orderId: string) => repo.findLiveOutbound(tx, orderId);
export const findLatestOutbound = (tx: Tx, orderId: string) => repo.findLatestOutbound(tx, orderId);
export const listPollable = (tx: Tx, limit = 50) => repo.listPollable(tx, limit);
export const listActiveShipments = (tx: Tx = db, take = 100) => repo.listActiveShipments(tx, take);

export interface ApplyStatus {
  status: ShipmentStatusId;
  description?: string | null;
  occurredAt?: Date;
  externalId?: string | null;
  actorId?: string | null;
  raw?: unknown;
  deliveredAt?: Date | null;
}

/**
 * Stores a status update and moves the parcel to it. Returns false when the update was already
 * stored (a repeated poll). A parcel that already ended (delivered or returned) never moves again.
 */
export async function applyStatus(
  tx: Tx,
  shipment: { id: string; status: string },
  update: ApplyStatus,
): Promise<boolean> {
  const stored = await repo.insertShipmentEvent(tx, {
    shipmentId: shipment.id,
    status: update.status,
    description: update.description ?? null,
    occurredAt: update.occurredAt ?? new Date(),
    externalId: update.externalId ?? null,
    actorId: update.actorId ?? null,
    raw: update.raw ?? null,
  });
  if (!stored) return false;
  if (shipment.status === 'delivered' || shipment.status === 'returned') return true;
  await repo.patchShipment(tx, shipment.id, {
    status: update.status,
    ...(update.deliveredAt ? { deliveredAt: update.deliveredAt } : {}),
  });
  return true;
}

export const patchShipment = (
  tx: Tx,
  id: string,
  data: {
    courierName?: string | null;
    trackingNumber?: string;
    costMinor?: bigint;
    codFeeMinor?: bigint;
  },
) => repo.patchShipment(tx, id, data);

// ---------------------------------------------------------------------------------------------
// Packaging profiles (6.9)
// ---------------------------------------------------------------------------------------------

export const listPackagingProfiles = (tx: Tx = db) => repo.listPackagingProfiles(tx);
export const findPackagingProfile = (tx: Tx, id: string) => repo.findPackagingProfile(tx, id);
export const defaultPackaging = (tx: Tx) => repo.findDefaultPackaging(tx);

export interface SavePackagingInput {
  id?: string;
  name: string;
  /** Major units, typed by staff ("35" or "35.50"). */
  cost: string;
  isDefault: boolean;
  active: boolean;
}

export interface PackagingActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Creates or edits a packaging profile. Exactly one profile can be the default. Audited. */
export async function savePackagingProfile(
  input: SavePackagingInput,
  actor: PackagingActor,
): Promise<string> {
  let costMinor: bigint;
  try {
    costMinor = fromDecimalString(input.cost, 'BDT').minor;
    if (costMinor < 0n) throw new Error('negative');
  } catch {
    throw new DomainError('VALIDATION', 'Enter the packaging cost in taka.', {
      fieldErrors: { cost: ['Enter an amount such as 35 or 35.50.'] },
    });
  }
  return db.$transaction(async (tx) => {
    const before = input.id ? await repo.findPackagingProfile(tx, input.id) : null;
    if (input.id && !before) throw new DomainError('NOT_FOUND', 'Packaging profile not found');
    if (input.isDefault) await repo.clearDefaultPackaging(tx);
    const saved = before
      ? await repo.patchPackagingProfile(tx, before.id, {
          name: input.name,
          costMinor,
          isDefault: input.isDefault,
          active: input.active,
        })
      : await repo.insertPackagingProfile(tx, {
          name: input.name,
          costMinor,
          currency: 'BDT',
          isDefault: input.isDefault,
          active: input.active,
        });
    await audit(tx, {
      actorId: actor.userId,
      action: before ? 'packaging.update' : 'packaging.create',
      entity: 'packaging_profile',
      entityId: saved.id,
      before: before
        ? { name: before.name, costMinor: before.costMinor.toString(), isDefault: before.isDefault }
        : null,
      after: {
        name: saved.name,
        costMinor: saved.costMinor.toString(),
        isDefault: saved.isDefault,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return saved.id;
  });
}

// The courier registry and its types, for the modules that book parcels (fulfilment).
export { getCourier, listCourierOptions } from './couriers/registry';
export { CourierError } from './couriers/types';
export type {
  BookingRequest,
  CourierId,
  CourierStatusUpdate,
  ShipmentStatusId,
} from './couriers/types';
