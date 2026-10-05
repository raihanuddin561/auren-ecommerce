import { describe, expect, it } from 'vitest';
import { money } from '@/lib/money';
import { GEO_DIVISIONS, geoCoverage, geoSlug } from '../geo-data';
import { formatEta, pickZone, priceRate, quoteFor, type ZoneRow } from '../quote';

const rate = (id: string, rateMinor: bigint, freeOverMinor: bigint | null = null) => ({
  id,
  name: 'Standard delivery',
  rateMinor,
  currency: 'BDT',
  freeOverMinor,
  minDays: 1,
  maxDays: 2,
  codAllowed: true,
});

const DIV = 'div-dhaka';
const DIST = 'dist-dhaka';
const THANA = 'thana-mirpur';

const inside: ZoneRow = {
  id: 'inside',
  name: 'Inside Dhaka',
  geoAreaIds: [DIST],
  isFallback: false,
  position: 0,
  rates: [rate('r1', 8000n, 500000n)],
};
const mirpurOnly: ZoneRow = {
  id: 'mirpur',
  name: 'Mirpur express',
  geoAreaIds: [THANA],
  isFallback: false,
  position: 2,
  rates: [rate('r3', 5000n)],
};
const outside: ZoneRow = {
  id: 'outside',
  name: 'Outside Dhaka',
  geoAreaIds: [],
  isFallback: true,
  position: 1,
  rates: [rate('r2', 13000n, 500000n)],
};

describe('zone selection', () => {
  it('uses the zone that names the district', () => {
    expect(pickZone([inside, outside], [DIV, DIST])?.id).toBe('inside');
  });

  it('the deepest named area wins over a wider zone', () => {
    expect(pickZone([inside, mirpurOnly, outside], [DIV, DIST, THANA])?.id).toBe('mirpur');
    expect(pickZone([inside, mirpurOnly, outside], [DIV, DIST])?.id).toBe('inside');
  });

  it('falls back to the zone that covers the rest of the country', () => {
    expect(pickZone([inside, outside], ['div-sylhet', 'dist-sylhet'])?.id).toBe('outside');
  });

  it('never serves from a zone without rates and returns null when nothing serves', () => {
    const empty = { ...inside, rates: [] };
    expect(pickZone([empty, outside], [DIV, DIST])?.id).toBe('outside');
    expect(pickZone([empty], [DIV, DIST])).toBeNull();
  });
});

describe('rate pricing', () => {
  it('charges the listed rate below the free-over threshold', () => {
    const option = priceRate(inside.rates[0]!, money(499999n, 'BDT'));
    expect(option.charge.minor).toBe(8000n);
    expect(option.free).toBe(false);
  });

  it('is free exactly at the threshold and above', () => {
    for (const subtotal of [500000n, 750000n]) {
      const option = priceRate(inside.rates[0]!, money(subtotal, 'BDT'));
      expect(option.charge.minor).toBe(0n);
      expect(option.free).toBe(true);
      expect(option.listed.minor).toBe(8000n);
    }
  });

  it('a rate without a threshold is never free', () => {
    expect(priceRate(mirpurOnly.rates[0]!, money(99999999n, 'BDT')).free).toBe(false);
  });

  it('quotes every rate of the zone', () => {
    const quote = quoteFor(
      { ...inside, rates: [rate('a', 8000n), rate('b', 12000n)] },
      money(1n, 'BDT'),
    );
    expect(quote.options.map((o) => o.rateId)).toEqual(['a', 'b']);
    expect(quote.zoneName).toBe('Inside Dhaka');
  });

  it('describes delivery time in plain words', () => {
    expect(formatEta(1, 2)).toBe('1 to 2 days');
    expect(formatEta(1, 1)).toBe('Next day');
    expect(formatEta(3, 3)).toBe('3 days');
    expect(formatEta(0, 0)).toBe('Same day');
  });
});

describe('delivery areas data', () => {
  it('has every division and district of Bangladesh', () => {
    const coverage = geoCoverage();
    expect(coverage.divisions).toBe(8);
    expect(coverage.districts).toBe(64);
  });

  it('lists thanas for the major districts and a meaningful number overall', () => {
    const coverage = geoCoverage();
    expect(coverage.districtsWithThanas).toBeGreaterThanOrEqual(30);
    expect(coverage.thanas).toBeGreaterThanOrEqual(300);
    const dhaka = GEO_DIVISIONS.find((d) => d.name === 'Dhaka')!.districts.find(
      (d) => d.name === 'Dhaka',
    )!;
    expect(dhaka.thanas).toContain('Mirpur');
    expect(dhaka.thanas).toContain('Gulshan');
    expect(dhaka.thanas).toContain('Savar');
  });

  it('has no duplicate district or thana names where codes would collide', () => {
    const districtCodes = new Set<string>();
    for (const division of GEO_DIVISIONS) {
      for (const district of division.districts) {
        const code = `${geoSlug(division.name)}/${geoSlug(district.name)}`;
        expect(districtCodes.has(code), code).toBe(false);
        districtCodes.add(code);
        const slugs = (district.thanas ?? []).map(geoSlug);
        expect(new Set(slugs).size, `${district.name} has duplicate thanas`).toBe(slugs.length);
      }
    }
    // Names are unique across the whole country at district level too.
    const names = GEO_DIVISIONS.flatMap((d) => d.districts.map((x) => x.name));
    expect(new Set(names).size).toBe(64);
  });

  it('slugs are stable, lowercase and free of apostrophes', () => {
    expect(geoSlug("Cox's Bazar")).toBe('coxs-bazar');
    expect(geoSlug('Sher-e-Bangla Nagar')).toBe('sher-e-bangla-nagar');
  });
});
