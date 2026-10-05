import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

/** Data access for delivery areas, zones and rates. */

export const listAreasByLevel = (tx: Tx, level: 'division' | 'district') =>
  tx.geoArea.findMany({
    where: { level, isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, parentId: true, name: true, nameBn: true, code: true },
  });

export const listChildAreas = (tx: Tx, parentId: string) =>
  tx.geoArea.findMany({
    where: { parentId, isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, code: true, level: true },
  });

export const findAreas = (tx: Tx, ids: readonly string[]) =>
  tx.geoArea.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, parentId: true, level: true, name: true, isActive: true },
  });

export const findAreaCodes = (tx: Tx) => tx.geoArea.findMany({ select: { id: true, code: true } });

export const createAreas = (tx: Tx, data: Prisma.GeoAreaCreateManyInput[]) =>
  tx.geoArea.createMany({ data, skipDuplicates: true });

export const countAreas = (tx: Tx) => tx.geoArea.count();

export const listZones = (tx: Tx, options: { activeOnly: boolean }) =>
  tx.shippingZone.findMany({
    where: options.activeOnly ? { isActive: true } : {},
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      rates: {
        where: options.activeOnly ? { isActive: true } : {},
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

export const findZone = (tx: Tx, id: string) =>
  tx.shippingZone.findUnique({ where: { id }, include: { rates: true } });

export const countZones = (tx: Tx) => tx.shippingZone.count();

export const createZone = (tx: Tx, data: Prisma.ShippingZoneUncheckedCreateInput) =>
  tx.shippingZone.create({ data });

export const updateZone = (tx: Tx, id: string, data: Prisma.ShippingZoneUncheckedUpdateInput) =>
  tx.shippingZone.update({ where: { id }, data });

export const findRate = (tx: Tx, id: string) => tx.shippingRate.findUnique({ where: { id } });

export const createRate = (tx: Tx, data: Prisma.ShippingRateUncheckedCreateInput) =>
  tx.shippingRate.create({ data });

export const updateRate = (tx: Tx, id: string, data: Prisma.ShippingRateUncheckedUpdateInput) =>
  tx.shippingRate.update({ where: { id }, data });
