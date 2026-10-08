import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { money, toDecimalString } from '@/lib/money';
import { GEO_DIVISIONS, geoSlug } from './geo-data';
import * as repo from './repository';
import { ensureReferenceData, listZonesForAdmin } from './service';
import type { AdminZone } from './types';

export interface AreaOption {
  id: string;
  name: string;
  nameBn?: string | null;
}

export interface DistrictOption extends AreaOption {
  divisionId: string;
}

/** Fallback static divisions and districts generated directly from GEO_DIVISIONS */
export function getStaticDivisionsAndDistricts(): {
  divisions: AreaOption[];
  districts: DistrictOption[];
} {
  const divisions: AreaOption[] = GEO_DIVISIONS.map((d) => ({
    id: geoSlug(d.name),
    name: d.name,
    nameBn: d.nameBn,
  }));
  const districts: DistrictOption[] = GEO_DIVISIONS.flatMap((d) =>
    d.districts.map((dist) => ({
      id: `${geoSlug(d.name)}/${geoSlug(dist.name)}`,
      name: dist.name,
      divisionId: geoSlug(d.name),
    })),
  );
  return { divisions, districts };
}

/** Divisions and districts for the address pickers: small, rarely changing, cached. */
export async function getDivisionsAndDistricts(): Promise<{
  divisions: AreaOption[];
  districts: DistrictOption[];
}> {
  try {
    let [divisions, districts] = await Promise.all([
      repo.listAreasByLevel(db, 'division'),
      repo.listAreasByLevel(db, 'district'),
    ]);

    // If database table is empty, auto-seed reference data on the fly
    if (divisions.length === 0) {
      try {
        await ensureReferenceData(db);
        [divisions, districts] = await Promise.all([
          repo.listAreasByLevel(db, 'division'),
          repo.listAreasByLevel(db, 'district'),
        ]);
      } catch (seedErr) {
        logger.warn({ seedErr }, 'Auto-seed of shipping areas failed/skipped');
      }
    }

    if (divisions.length > 0) {
      return {
        divisions: divisions.map((d) => ({ id: d.id, name: d.name, nameBn: d.nameBn })),
        districts: districts
          .filter((d) => d.parentId)
          .map((d) => ({ id: d.id, name: d.name, divisionId: d.parentId! })),
      };
    }
  } catch (err) {
    logger.warn(
      { err },
      'Error querying DB for divisions and districts; falling back to static geo data',
    );
  }

  // Guaranteed fallback: return all 8 divisions and 64 districts so user is NEVER blocked
  return getStaticDivisionsAndDistricts();
}

/** Zones and rates for the settings page. Uncached: staff must see what they just saved. */
export async function getShippingConfigForAdmin(): Promise<AdminZone[]> {
  const [zones, divisions, districts] = await Promise.all([
    listZonesForAdmin(),
    repo.listAreasByLevel(db, 'division'),
    repo.listAreasByLevel(db, 'district'),
  ]);
  const names = new Map([...divisions, ...districts].map((area) => [area.id, area.name]));
  const thanaIds = zones.flatMap((zone) => zone.geoAreaIds).filter((id) => !names.has(id));
  if (thanaIds.length > 0) {
    for (const area of await repo.findAreas(db, thanaIds)) names.set(area.id, area.name);
  }
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    isFallback: zone.isFallback,
    isActive: zone.isActive,
    geoAreaIds: zone.geoAreaIds,
    coverage: zone.geoAreaIds.map((id) => names.get(id) ?? 'Unknown area'),
    rates: zone.rates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      rate: toDecimalString(money(rate.rateMinor, rate.currency)),
      freeOver:
        rate.freeOverMinor === null
          ? ''
          : toDecimalString(money(rate.freeOverMinor, rate.currency)),
      minDays: rate.minDays,
      maxDays: rate.maxDays,
      codAllowed: rate.codAllowed,
      isActive: rate.isActive,
    })),
  }));
}
