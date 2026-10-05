import { db } from '@/lib/db';
import { money, toDecimalString } from '@/lib/money';
import * as repo from './repository';
import type { AdminZone } from './types';
import { listZonesForAdmin } from './service';

export interface AreaOption {
  id: string;
  name: string;
  nameBn?: string | null;
}

export interface DistrictOption extends AreaOption {
  divisionId: string;
}

/** Divisions and districts for the address pickers: small, rarely changing, cached. */
export async function getDivisionsAndDistricts(): Promise<{
  divisions: AreaOption[];
  districts: DistrictOption[];
}> {
  const [divisions, districts] = await Promise.all([
    repo.listAreasByLevel(db, 'division'),
    repo.listAreasByLevel(db, 'district'),
  ]);
  return {
    divisions: divisions.map((d) => ({ id: d.id, name: d.name, nameBn: d.nameBn })),
    districts: districts
      .filter((d) => d.parentId)
      .map((d) => ({ id: d.id, name: d.name, divisionId: d.parentId! })),
  };
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
