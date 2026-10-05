import { compare, money, type Money } from '@/lib/money';

/** Pure delivery pricing: which zone serves an address and what each of its rates costs. */

export interface ZoneRateRow {
  id: string;
  name: string;
  rateMinor: bigint;
  currency: string;
  freeOverMinor: bigint | null;
  minDays: number;
  maxDays: number;
  codAllowed: boolean;
}

export interface ZoneRow {
  id: string;
  name: string;
  geoAreaIds: readonly string[];
  isFallback: boolean;
  position: number;
  rates: readonly ZoneRateRow[];
}

export interface DeliveryOption {
  rateId: string;
  name: string;
  /** What the customer pays for delivery on this subtotal (zero when the free-over rule applies). */
  charge: Money;
  /** The listed rate before the free-over rule. */
  listed: Money;
  free: boolean;
  /** The subtotal at which delivery becomes free, or null when it never does. */
  freeOver: Money | null;
  minDays: number;
  maxDays: number;
  codAllowed: boolean;
}

export interface DeliveryQuote {
  zoneId: string;
  zoneName: string;
  options: DeliveryOption[];
}

/**
 * The zone for an address. `chainIds` runs from the division down to the most specific area the
 * customer chose; the zone that names the deepest of them wins (a thana zone beats a district
 * zone), and the fallback zone serves everything no zone names. Zones without rates never serve.
 */
export function pickZone(zones: readonly ZoneRow[], chainIds: readonly string[]): ZoneRow | null {
  let best: { zone: ZoneRow; depth: number } | null = null;
  for (const zone of zones) {
    if (zone.isFallback || zone.rates.length === 0) continue;
    let depth = -1;
    chainIds.forEach((id, index) => {
      if (zone.geoAreaIds.includes(id)) depth = Math.max(depth, index);
    });
    if (depth < 0) continue;
    if (
      !best ||
      depth > best.depth ||
      (depth === best.depth && zone.position < best.zone.position)
    ) {
      best = { zone, depth };
    }
  }
  if (best) return best.zone;
  return zones.find((zone) => zone.isFallback && zone.rates.length > 0) ?? null;
}

export function priceRate(rate: ZoneRateRow, subtotal: Money): DeliveryOption {
  const listed = money(rate.rateMinor, rate.currency);
  const freeOver = rate.freeOverMinor === null ? null : money(rate.freeOverMinor, rate.currency);
  const free =
    freeOver !== null &&
    subtotal.currency === freeOver.currency &&
    compare(subtotal, freeOver) >= 0;
  return {
    rateId: rate.id,
    name: rate.name,
    charge: free ? money(0n, rate.currency) : listed,
    listed,
    free,
    freeOver,
    minDays: rate.minDays,
    maxDays: rate.maxDays,
    codAllowed: rate.codAllowed,
  };
}

export function quoteFor(zone: ZoneRow, subtotal: Money): DeliveryQuote {
  return {
    zoneId: zone.id,
    zoneName: zone.name,
    options: zone.rates.map((rate) => priceRate(rate, subtotal)),
  };
}

/** "1 to 2 days", "Next day", "Same day". */
export function formatEta(minDays: number, maxDays: number): string {
  if (maxDays === 0) return 'Same day';
  if (minDays === maxDays) return maxDays === 1 ? 'Next day' : `${maxDays} days`;
  return `${minDays} to ${maxDays} days`;
}
