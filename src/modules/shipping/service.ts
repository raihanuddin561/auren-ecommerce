import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { fromDecimalString, money, type Money } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import { GEO_DIVISIONS, geoSlug } from './geo-data';
import { pickZone, quoteFor, type DeliveryQuote, type ZoneRow } from './quote';
import * as repo from './repository';
import type { AreaSelection, SaveRateInput, SaveZoneInput } from './schemas';

export const SHIPPING_CURRENCY = 'BDT';
export const SHIPPING_TAG = 'shipping';
export const GEO_TAG = 'geo';

/** Division codes are slugs (`dhaka`); a district adds its own (`dhaka/dhaka`), a thana another. */
const districtCode = (division: string, district: string) =>
  `${geoSlug(division)}/${geoSlug(district)}`;

// ---------------------------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------------------------

export interface ResolvedArea {
  division: { id: string; name: string };
  district: { id: string; name: string };
  thana: { id: string; name: string } | null;
  /** Division, district and (when chosen) thana, shallowest first. */
  chainIds: string[];
}

/**
 * Checks that the area selection forms a valid delivery location and returns names.
 * Resilient to manual text, static slugs, or unseeded databases so customers are never blocked.
 */
export async function resolveArea(tx: Tx, selection: AreaSelection): Promise<ResolvedArea> {
  const ids = [selection.divisionId, selection.districtId];
  if (selection.thanaId) ids.push(selection.thanaId);

  let rows = new Map((await repo.findAreas(tx, ids)).map((row) => [row.id, row]));
  let division = rows.get(selection.divisionId);
  let district = rows.get(selection.districtId);
  let thana = selection.thanaId ? rows.get(selection.thanaId) : undefined;

  // If not found in DB by UUID, try auto-seeding reference data if DB is empty
  if (!division || !district) {
    try {
      if ((await repo.countAreas(tx)) === 0) {
        await ensureReferenceData(tx);
        rows = new Map((await repo.findAreas(tx, ids)).map((row) => [row.id, row]));
        division = rows.get(selection.divisionId);
        district = rows.get(selection.districtId);
        if (selection.thanaId) thana = rows.get(selection.thanaId);
      }
    } catch {
      // Ignore seed failure
    }
  }

  // If IDs were slugs (e.g. 'dhaka', 'dhaka/dhaka') or text names, match by code or name
  if (!division || !district) {
    try {
      const allCodes = await repo.findAreaCodes(tx);
      const divSlug = geoSlug(selection.divisionName || selection.divisionId);
      const distSlug = districtCode(
        selection.divisionName || selection.divisionId,
        selection.districtName || selection.districtId,
      );
      const matchedDiv = allCodes.find(
        (a) => a.code === divSlug || a.code === selection.divisionId,
      );
      const matchedDist = allCodes.find(
        (a) => a.code === distSlug || a.code === selection.districtId,
      );

      if (matchedDiv && !division) {
        const found = await repo.findAreas(tx, [matchedDiv.id]);
        if (found[0]) division = found[0];
      }
      if (matchedDist && !district) {
        const found = await repo.findAreas(tx, [matchedDist.id]);
        if (found[0]) district = found[0];
      }
    } catch {
      // Ignore lookup failure
    }
  }

  // If both division and district rows exist in database
  if (division && district) {
    // Manual entry stays open, but a pair taken from the known lists must still be one branch of
    // the hierarchy: a district of that division, a thana of that district (forged ids are refused).
    const branchOk =
      division.level === 'division' &&
      division.isActive &&
      district.level === 'district' &&
      district.isActive &&
      district.parentId === division.id &&
      (!thana || (thana.level === 'thana' && thana.isActive && thana.parentId === district.id));
    if (!branchOk) {
      throw new DomainError('VALIDATION', 'Please choose your division, district and area again.', {
        fieldErrors: { districtId: ['Please choose a district in the selected division.'] },
      });
    }
    return {
      division: { id: division.id, name: division.name },
      district: { id: district.id, name: district.name },
      thana: thana
        ? { id: thana.id, name: thana.name }
        : selection.thanaName
          ? { id: 'manual-thana', name: selection.thanaName }
          : null,
      chainIds: [division.id, district.id, ...(thana ? [thana.id] : [])],
    };
  }

  // Graceful fallback for free-text / unlisted entries: NEVER block customer order!
  const divName = division?.name || selection.divisionName || selection.divisionId;
  const distName = district?.name || selection.districtName || selection.districtId;
  const thanaName = thana?.name || selection.thanaName || '';
  const isDhaka =
    distName.toLowerCase().includes('dhaka') || divName.toLowerCase().includes('dhaka');

  // Match zone geoAreaId for quoteDelivery if possible
  const allZones = await repo.listZones(tx, { activeOnly: true });
  const insideDhaka = allZones.find(
    (z) => !z.isFallback && z.name.toLowerCase().includes('inside dhaka'),
  );
  const fallbackZone = allZones.find((z) => z.isFallback);
  const matchedAreaId =
    (isDhaka && insideDhaka ? insideDhaka.geoAreaIds[0] : fallbackZone?.geoAreaIds[0]) ||
    'fallback-area-id';

  return {
    division: { id: division?.id || 'manual-division', name: divName },
    district: { id: district?.id || 'manual-district', name: distName },
    thana: thanaName ? { id: thana?.id || 'manual-thana', name: thanaName } : null,
    chainIds: [division?.id || 'manual-division', district?.id || 'manual-district', matchedAreaId],
  };
}

/** Thanas and upazilas of one district (empty when none are listed). */
export async function listThanasOf(districtId: string) {
  const children = await repo.listChildAreas(db, districtId);
  return children.filter((c) => c.level === 'thana').map((c) => ({ id: c.id, name: c.name }));
}

// ---------------------------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------------------------

const toZoneRows = (zones: Awaited<ReturnType<typeof repo.listZones>>): ZoneRow[] =>
  zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    geoAreaIds: zone.geoAreaIds,
    isFallback: zone.isFallback,
    position: zone.position,
    rates: zone.rates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      rateMinor: rate.rateMinor,
      currency: rate.currency,
      freeOverMinor: rate.freeOverMinor,
      minDays: rate.minDays,
      maxDays: rate.maxDays,
      codAllowed: rate.codAllowed,
    })),
  }));

/** The delivery options and prices for an area and a subtotal, read from the rates table. */
export async function quoteDelivery(
  tx: Tx,
  area: Pick<ResolvedArea, 'chainIds'>,
  subtotal: Money,
): Promise<DeliveryQuote> {
  let zones = toZoneRows(await repo.listZones(tx, { activeOnly: true }));
  if (zones.length === 0) {
    try {
      await ensureReferenceData(tx);
      zones = toZoneRows(await repo.listZones(tx, { activeOnly: true }));
    } catch {
      // Ignore
    }
  }

  let zone = pickZone(zones, area.chainIds);
  if (!zone && zones.length > 0) {
    zone =
      zones.find((z) => z.isFallback && z.rates.length > 0) ||
      zones.find((z) => z.rates.length > 0) ||
      null;
  }

  if (!zone) {
    // Ultimate fallback quote so order is never blocked even if rates table is empty
    const fee = money(13000n, subtotal.currency);
    return {
      zoneId: 'default-zone',
      zoneName: 'Standard delivery',
      options: [
        {
          rateId: 'default-rate-cod',
          name: 'Standard delivery (All Bangladesh)',
          charge: fee,
          listed: fee,
          free: false,
          freeOver: null,
          minDays: 2,
          maxDays: 4,
          codAllowed: true,
        },
      ],
    };
  }

  return quoteFor(zone, subtotal);
}

/**
 * The subtotal at which delivery becomes free, for the "free delivery" bar in the bag, before an
 * address is known. It follows the fallback zone (the whole country), the safe promise to make.
 */
export async function freeDeliveryThreshold(tx: Tx = db): Promise<Money | null> {
  const zones = toZoneRows(await repo.listZones(tx, { activeOnly: true }));
  const fallback = zones.find((zone) => zone.isFallback);
  const thresholds = (fallback?.rates ?? [])
    .filter((rate) => rate.freeOverMinor !== null)
    .map((rate) => money(rate.freeOverMinor!, rate.currency));
  if (thresholds.length === 0) return null;
  return thresholds.reduce((lowest, next) => (next.minor < lowest.minor ? next : lowest));
}

// ---------------------------------------------------------------------------------------------
// Admin: zones and rates
// ---------------------------------------------------------------------------------------------

export interface ShippingActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

const auditContext = (actor: ShippingActor) => ({
  ...(actor.ip ? { ip: actor.ip } : {}),
  ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
});

const parseAmount = (text: string, field: string): Money => {
  try {
    const value = fromDecimalString(text, SHIPPING_CURRENCY);
    if (value.minor < 0n) throw new Error('negative');
    return value;
  } catch {
    throw new DomainError('VALIDATION', 'Enter a valid amount in taka, for example 80 or 1,500.', {
      fieldErrors: { [field]: ['Enter a valid amount in taka, for example 80 or 1,500.'] },
    });
  }
};

export async function listZonesForAdmin() {
  return repo.listZones(db, { activeOnly: false });
}

export async function saveZone(input: SaveZoneInput, actor: ShippingActor): Promise<string> {
  return db.$transaction(async (tx) => {
    const before = input.id ? await repo.findZone(tx, input.id) : null;
    if (input.id && !before) throw new DomainError('NOT_FOUND', 'That zone no longer exists.');
    if (before?.isFallback && !input.isActive) {
      throw new DomainError(
        'CONFLICT',
        'The zone that covers the rest of the country cannot be switched off.',
      );
    }
    const geoAreaIds = before?.isFallback ? [] : [...new Set(input.geoAreaIds)];
    if (geoAreaIds.length > 0) {
      const found = await repo.findAreas(tx, geoAreaIds);
      if (found.length !== geoAreaIds.length) {
        throw new DomainError('VALIDATION', 'One of the chosen areas does not exist.');
      }
    }
    const data = { name: input.name, geoAreaIds, isActive: input.isActive };
    const after = before
      ? await repo.updateZone(tx, before.id, data)
      : await repo.createZone(tx, { ...data, isFallback: false });
    await audit(tx, {
      actorId: actor.userId,
      ...auditContext(actor),
      action: before ? 'shipping_zone.update' : 'shipping_zone.create',
      entity: 'shipping_zone',
      entityId: after.id,
      before: before ?? undefined,
      after,
    });
    return after.id;
  });
}

export async function saveRate(input: SaveRateInput, actor: ShippingActor): Promise<string> {
  const rate = parseAmount(input.rate, 'rate');
  const freeOver = input.freeOver ? parseAmount(input.freeOver, 'freeOver') : null;
  if (freeOver !== null && freeOver.minor === 0n) {
    throw new DomainError('VALIDATION', 'Leave "free over" empty, or enter an amount above zero.', {
      fieldErrors: { freeOver: ['Leave this empty, or enter an amount above zero.'] },
    });
  }
  return db.$transaction(async (tx) => {
    const zone = await repo.findZone(tx, input.zoneId);
    if (!zone) throw new DomainError('NOT_FOUND', 'That zone no longer exists.');
    const before = input.id ? await repo.findRate(tx, input.id) : null;
    if (input.id && (!before || before.zoneId !== zone.id)) {
      throw new DomainError('NOT_FOUND', 'That rate no longer exists.');
    }
    const data = {
      name: input.name,
      rateMinor: rate.minor,
      freeOverMinor: freeOver?.minor ?? null,
      minDays: input.minDays,
      maxDays: input.maxDays,
      codAllowed: input.codAllowed,
      isActive: input.isActive,
    };
    const after = before
      ? await repo.updateRate(tx, before.id, data)
      : await repo.createRate(tx, { ...data, zoneId: zone.id, currency: SHIPPING_CURRENCY });
    await audit(tx, {
      actorId: actor.userId,
      ...auditContext(actor),
      action: before ? 'shipping_rate.update' : 'shipping_rate.create',
      entity: 'shipping_rate',
      entityId: after.id,
      before: before ?? undefined,
      after,
    });
    return after.id;
  });
}

// ---------------------------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------------------------

export interface ReferenceSeedResult {
  areasAdded: number;
  zonesAdded: number;
}

/**
 * Installs the delivery areas and the two default zones. Idempotent and additive: it adds rows that
 * are missing and never edits or removes one, so an owner's changes survive. Run by the seed, by
 * `pnpm db:seed:reference` on a new database, and by tests.
 */
export async function ensureReferenceData(tx: Tx): Promise<ReferenceSeedResult> {
  const before = await repo.countAreas(tx);

  await repo.createAreas(
    tx,
    GEO_DIVISIONS.map((division, index) => ({
      level: 'division' as const,
      code: geoSlug(division.name),
      name: division.name,
      nameBn: division.nameBn,
      position: index,
    })),
  );
  let idByCode = new Map((await repo.findAreaCodes(tx)).map((row) => [row.code, row.id]));

  await repo.createAreas(
    tx,
    GEO_DIVISIONS.flatMap((division) =>
      division.districts.map((district, index) => ({
        level: 'district' as const,
        parentId: idByCode.get(geoSlug(division.name))!,
        code: districtCode(division.name, district.name),
        name: district.name,
        position: index,
      })),
    ),
  );
  idByCode = new Map((await repo.findAreaCodes(tx)).map((row) => [row.code, row.id]));

  await repo.createAreas(
    tx,
    GEO_DIVISIONS.flatMap((division) =>
      division.districts.flatMap((district) =>
        [...new Set(district.thanas ?? [])].map((thana, index) => ({
          level: 'thana' as const,
          parentId: idByCode.get(districtCode(division.name, district.name))!,
          code: `${districtCode(division.name, district.name)}/${geoSlug(thana)}`,
          name: thana,
          position: index,
        })),
      ),
    ),
  );
  const areasAdded = (await repo.countAreas(tx)) - before;

  let zonesAdded = 0;
  if ((await repo.countZones(tx)) === 0) {
    const dhaka = (await repo.findAreaCodes(tx)).find((row) => row.code === 'dhaka/dhaka');
    const inside = await repo.createZone(tx, {
      name: 'Inside Dhaka',
      geoAreaIds: dhaka ? [dhaka.id] : [],
      isFallback: false,
      position: 0,
    });
    const outside = await repo.createZone(tx, {
      name: 'Outside Dhaka',
      geoAreaIds: [],
      isFallback: true,
      position: 1,
    });
    await repo.createRate(tx, {
      zoneId: inside.id,
      name: 'Standard delivery',
      rateMinor: 8000n,
      freeOverMinor: 500000n,
      minDays: 1,
      maxDays: 2,
      codAllowed: true,
      currency: SHIPPING_CURRENCY,
    });
    await repo.createRate(tx, {
      zoneId: outside.id,
      name: 'Standard delivery',
      rateMinor: 13000n,
      freeOverMinor: 500000n,
      minDays: 3,
      maxDays: 5,
      codAllowed: true,
      currency: SHIPPING_CURRENCY,
    });
    zonesAdded = 2;
  }
  return { areasAdded, zonesAdded };
}
