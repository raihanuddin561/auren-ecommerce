import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUERY,
  activeFilterCount,
  buildFacets,
  compareSizes,
  defaultOrderFor,
  filterRows,
  gridColumnClasses,
  isPlainQuery,
  listingHref,
  listingSearch,
  listingSeo,
  pageLinks,
  paginate,
  parseListingQuery,
  priceBoundsMinor,
  sortRows,
  toListingRow,
  type ListingRow,
} from '../listing';

const row = (overrides: Partial<ListingRow> & { id: string }): ListingRow => ({
  publishedAt: new Date('2026-09-01T00:00:00Z'),
  featuredRank: null,
  position: 0,
  minPriceMinor: 249000n,
  fit: 'regular',
  fabric: 'Cotton',
  colors: [{ value: 'white', label: 'White', hex: '#F8F8F6' }],
  sizes: ['S', 'M', 'L'],
  ...overrides,
});

const q = (patch: Partial<typeof EMPTY_QUERY> = {}) => ({ ...EMPTY_QUERY, ...patch });

describe('parseListingQuery', () => {
  it('reads repeated values, sorts and de-duplicates them', () => {
    const parsed = parseListingQuery({
      size: ['M', 'S', 'M'],
      color: 'white',
      fit: ['relaxed', 'slim'],
    });
    expect(parsed.size).toEqual(['M', 'S']);
    expect(parsed.color).toEqual(['white']);
    expect(parsed.fit).toEqual(['relaxed', 'slim']);
  });

  it('ignores unknown keys and invalid values instead of failing', () => {
    const parsed = parseListingQuery({
      sort: 'cheapest',
      page: '-3',
      density: '9',
      fit: ['baggy', 'slim'],
      min: 'abc',
      max: '1e9',
      instock: 'maybe',
      evil: '<script>',
      size: '',
    });
    expect(parsed).toEqual({ ...EMPTY_QUERY, fit: ['slim'] });
  });

  it('keeps valid sort, page, density and the in-stock flag', () => {
    const parsed = parseListingQuery({ sort: 'price-asc', page: '3', density: '2', instock: '1' });
    expect(parsed.sort).toBe('price-asc');
    expect(parsed.page).toBe(3);
    expect(parsed.density).toBe(2);
    expect(parsed.inStock).toBe(true);
  });

  it('caps the page number and the number of repeated values', () => {
    expect(parseListingQuery({ page: '100000' }).page).toBe(1);
    const many = Array.from({ length: 40 }, (_, i) => `v${i}`);
    expect(parseListingQuery({ size: many }).size).toHaveLength(12);
  });

  it('refuses over-long values', () => {
    expect(parseListingQuery({ color: 'x'.repeat(41) }).color).toEqual([]);
  });

  it('normalises prices and drops a maximum below the minimum', () => {
    expect(parseListingQuery({ min: '02500.00', max: '4000.5' })).toMatchObject({
      minPrice: '2500',
      maxPrice: '4000.50',
    });
    expect(parseListingQuery({ min: '5000', max: '1000' })).toMatchObject({
      minPrice: '5000',
      maxPrice: null,
    });
  });

  it('refuses more than two decimal places', () => {
    expect(parseListingQuery({ min: '10.999' }).minPrice).toBeNull();
  });

  it('uses the first value of a repeated single-value key', () => {
    expect(parseListingQuery({ sort: ['newest', 'price-asc'] }).sort).toBe('newest');
  });
});

describe('listingSearch and listingHref', () => {
  it('omits defaults and writes a stable order', () => {
    expect(listingSearch(EMPTY_QUERY)).toBe('');
    expect(listingHref('/shop', EMPTY_QUERY)).toBe('/shop');
    const query = q({
      size: ['M'],
      color: ['white', 'navy'],
      sort: 'newest',
      page: 2,
      inStock: true,
    });
    expect(listingSearch(query)).toBe('size=M&color=white&color=navy&instock=1&sort=newest&page=2');
  });

  it('round-trips through the parser', () => {
    const query = q({
      size: ['L', 'M'],
      color: ['navy'],
      fit: ['slim'],
      fabric: ['Egyptian cotton'],
      minPrice: '1500',
      maxPrice: '4000.50',
      inStock: true,
      sort: 'price-desc',
      page: 4,
      density: 3,
    });
    const params = new URLSearchParams(listingSearch(query));
    const raw: Record<string, string[]> = {};
    for (const key of new Set(params.keys())) raw[key] = params.getAll(key);
    expect(parseListingQuery(raw)).toEqual(query);
  });
});

describe('price conversion', () => {
  it('converts whole units to minor units without floats', () => {
    expect(priceBoundsMinor(q({ minPrice: '2500', maxPrice: '4000.50' }))).toEqual({
      min: 250000n,
      max: 400050n,
    });
    expect(priceBoundsMinor(EMPTY_QUERY)).toEqual({ min: null, max: null });
  });
});

describe('filterRows', () => {
  const rows = [
    row({ id: 'a', colors: [{ value: 'white', label: 'White', hex: null }], sizes: ['S', 'M'] }),
    row({
      id: 'b',
      colors: [{ value: 'navy', label: 'Navy', hex: null }],
      sizes: ['M', 'L'],
      fit: 'slim',
    }),
    row({
      id: 'c',
      colors: [{ value: 'navy', label: 'Navy', hex: null }],
      sizes: ['L'],
      fabric: 'Linen',
      minPriceMinor: 599000n,
    }),
  ];
  const ids = (list: ListingRow[]) => list.map((r) => r.id);

  it('matches any chosen value inside a facet and all facets together', () => {
    expect(ids(filterRows(rows, q({ color: ['navy'] }), null))).toEqual(['b', 'c']);
    expect(ids(filterRows(rows, q({ color: ['navy'], size: ['M'] }), null))).toEqual(['b']);
    expect(ids(filterRows(rows, q({ size: ['S', 'L'] }), null))).toEqual(['a', 'b', 'c']);
  });

  it('filters by fit, fabric and price range', () => {
    expect(ids(filterRows(rows, q({ fit: ['slim'] }), null))).toEqual(['b']);
    expect(ids(filterRows(rows, q({ fabric: ['Linen'] }), null))).toEqual(['c']);
    expect(ids(filterRows(rows, q({ minPrice: '3000' }), null))).toEqual(['c']);
    expect(ids(filterRows(rows, q({ maxPrice: '2490' }), null))).toEqual(['a', 'b']);
  });

  it('applies the in-stock set only when the filter is on', () => {
    const stock = new Set(['b']);
    expect(ids(filterRows(rows, q({ inStock: true }), stock))).toEqual(['b']);
    expect(ids(filterRows(rows, q(), stock))).toEqual(['a', 'b', 'c']);
  });

  it('can ignore one facet, which is how its own counts are worked out', () => {
    expect(ids(filterRows(rows, q({ color: ['navy'], size: ['S'] }), null, 'size'))).toEqual([
      'b',
      'c',
    ]);
  });
});

describe('buildFacets', () => {
  const rows = [
    row({ id: 'a', colors: [{ value: 'white', label: 'White', hex: '#fff' }], sizes: ['S', 'M'] }),
    row({
      id: 'b',
      colors: [{ value: 'navy', label: 'Navy', hex: '#123' }],
      sizes: ['M', 'XL'],
      fit: 'slim',
    }),
    row({
      id: 'c',
      colors: [{ value: 'navy', label: 'Navy', hex: '#123' }],
      sizes: ['M'],
      fabric: 'Linen',
    }),
  ];

  it('counts options in natural size order and by colour popularity', () => {
    const facets = buildFacets(rows, EMPTY_QUERY, null);
    expect(facets.size.map((o) => [o.value, o.count])).toEqual([
      ['S', 1],
      ['M', 3],
      ['XL', 1],
    ]);
    expect(facets.color.map((o) => [o.value, o.count])).toEqual([
      ['navy', 2],
      ['white', 1],
    ]);
    expect(facets.fit.map((o) => o.value)).toEqual(['slim', 'regular']);
    expect(facets.priceRange).toEqual({ min: '2490', max: '2490' });
  });

  it('counts a facet with every other filter applied but not its own', () => {
    const facets = buildFacets(rows, q({ color: ['navy'], size: ['S'] }), null);
    // Size counts ignore the size choice: navy products only.
    expect(facets.size.map((o) => [o.value, o.count])).toEqual([
      ['S', 0],
      ['M', 2],
      ['XL', 1],
    ]);
    // Colour counts ignore the colour choice: products that have size S.
    expect(facets.color.find((o) => o.value === 'white')?.count).toBe(1);
    expect(facets.color.find((o) => o.value === 'navy')?.count).toBe(0);
  });

  it('keeps a selected value listed even when nothing matches it', () => {
    const facets = buildFacets(rows, q({ size: ['XXL'] }), null);
    const xxl = facets.size.find((o) => o.value === 'XXL');
    expect(xxl).toMatchObject({ count: 0, selected: true });
  });

  it('has no price range for an empty scope', () => {
    expect(buildFacets([], EMPTY_QUERY, null).priceRange).toBeNull();
  });
});

describe('sorting and pagination', () => {
  const rows = [
    row({
      id: 'old',
      publishedAt: new Date('2026-01-01'),
      minPriceMinor: 300000n,
      featuredRank: null,
      position: 2,
    }),
    row({
      id: 'new',
      publishedAt: new Date('2026-09-20'),
      minPriceMinor: 100000n,
      featuredRank: null,
      position: 0,
    }),
    row({
      id: 'top',
      publishedAt: new Date('2026-03-01'),
      minPriceMinor: 200000n,
      featuredRank: 1,
      position: 1,
    }),
  ];
  const ids = (list: ListingRow[]) => list.map((r) => r.id);

  it('puts ranked products first, then the newest, for featured', () => {
    expect(ids(sortRows(rows, 'featured', 'featured'))).toEqual(['top', 'new', 'old']);
  });

  it('sorts by newest and by price in both directions', () => {
    expect(ids(sortRows(rows, 'newest', 'featured'))).toEqual(['new', 'top', 'old']);
    expect(ids(sortRows(rows, 'price-asc', 'featured'))).toEqual(['new', 'top', 'old']);
    expect(ids(sortRows(rows, 'price-desc', 'featured'))).toEqual(['old', 'top', 'new']);
  });

  it('uses the collection order for featured, and still lets the visitor sort', () => {
    expect(ids(sortRows(rows, 'featured', 'position'))).toEqual(['new', 'top', 'old']);
    expect(ids(sortRows(rows, 'price-desc', 'position'))).toEqual(['old', 'top', 'new']);
  });

  it('maps collection sort orders to the page default', () => {
    expect(defaultOrderFor('manual')).toBe('position');
    expect(defaultOrderFor('best_selling')).toBe('position');
    expect(defaultOrderFor('newest')).toBe('newest');
    expect(defaultOrderFor('price_asc')).toBe('price-asc');
    expect(defaultOrderFor('price_desc')).toBe('price-desc');
    expect(defaultOrderFor(null)).toBe('featured');
  });

  it('paginates in pages of 24', () => {
    const many = Array.from({ length: 50 }, (_, i) => i);
    const second = paginate(many, 2);
    expect(second.items).toHaveLength(24);
    expect(second.totalPages).toBe(3);
    expect(paginate(many, 3).items).toHaveLength(2);
    expect(paginate([], 1)).toMatchObject({ totalPages: 1, total: 0 });
  });

  it('orders sizes naturally', () => {
    const sorted = ['XL', '34', 'S', 'One Size', '30', 'M', 'XXL'].sort(compareSizes);
    expect(sorted).toEqual(['S', 'M', 'XL', 'XXL', '30', '34', 'One Size']);
  });
});

describe('search engine rules', () => {
  it('indexes a plain page and page N on its own address', () => {
    expect(listingSeo('/shop/shirts', EMPTY_QUERY)).toEqual({
      canonical: '/shop/shirts',
      index: true,
    });
    expect(listingSeo('/shop/shirts', q({ page: 3 }))).toEqual({
      canonical: '/shop/shirts?page=3',
      index: true,
    });
  });

  it('gives one colour or one fit a self-canonical address', () => {
    expect(listingSeo('/shop/shirts', q({ color: ['white'] }))).toEqual({
      canonical: '/shop/shirts?color=white',
      index: true,
    });
    expect(listingSeo('/shop/shirts', q({ fit: ['slim'] }))).toEqual({
      canonical: '/shop/shirts?fit=slim',
      index: true,
    });
  });

  it('points every other combination at the base address with noindex', () => {
    const base = { canonical: '/shop/shirts', index: false };
    expect(listingSeo('/shop/shirts', q({ color: ['white', 'navy'] }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ color: ['white'], fit: ['slim'] }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ color: ['white'], size: ['M'] }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ size: ['M'] }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ fabric: ['Linen'] }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ minPrice: '1000' }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ inStock: true }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ sort: 'newest' }))).toEqual(base);
    expect(listingSeo('/shop/shirts', q({ density: 2 }))).toEqual(base);
  });

  it('does not index deep pages of a facet', () => {
    expect(listingSeo('/shop', q({ color: ['white'], page: 2 }))).toEqual({
      canonical: '/shop?color=white',
      index: false,
    });
  });

  it('builds previous and next links', () => {
    const links = pageLinks('/shop', q({ page: 2, color: ['white'] }), 3);
    expect(links.prev).toBe('/shop?color=white');
    expect(links.next).toBe('/shop?color=white&page=3');
    expect(pageLinks('/shop', EMPTY_QUERY, 1)).toMatchObject({ prev: null, next: null });
  });
});

describe('query helpers', () => {
  it('counts facet selections, treating a price range as one', () => {
    expect(activeFilterCount(EMPTY_QUERY)).toBe(0);
    expect(
      activeFilterCount(
        q({ size: ['M', 'L'], color: ['navy'], minPrice: '1', maxPrice: '9', inStock: true }),
      ),
    ).toBe(5);
  });

  it('treats sort and density as cosmetic for the plain-page cache', () => {
    expect(isPlainQuery(EMPTY_QUERY)).toBe(true);
    expect(isPlainQuery(q({ sort: 'newest' }))).toBe(false);
    expect(isPlainQuery(q({ size: ['M'] }))).toBe(false);
  });

  it('maps density to grid columns', () => {
    expect(gridColumnClasses(null)).toBe('grid-cols-2 md:grid-cols-4');
    expect(gridColumnClasses(1)).toContain('grid-cols-1');
    expect(gridColumnClasses(2)).toBe('grid-cols-2 md:grid-cols-2');
    expect(gridColumnClasses(3)).toBe('grid-cols-2 md:grid-cols-3');
  });
});

describe('toListingRow', () => {
  const source = {
    id: 'p1',
    publishedAt: new Date('2026-09-01'),
    featuredRank: 2,
    fit: 'slim',
    attributes: { fabric: ' Egyptian cotton ' },
    collections: [{ position: 7 }],
    variants: [
      {
        priceMinor: 249000n,
        optionValues: [
          {
            optionValue: {
              value: 'white',
              label: 'White',
              swatchHex: '#fff',
              option: { name: 'Color' },
            },
          },
          { optionValue: { value: 'm', label: 'M', swatchHex: null, option: { name: 'Size' } } },
        ],
      },
      {
        priceMinor: 199000n,
        optionValues: [
          {
            optionValue: {
              value: 'white',
              label: 'White',
              swatchHex: '#fff',
              option: { name: 'Colour' },
            },
          },
          { optionValue: { value: 'l', label: 'L', swatchHex: null, option: { name: 'size' } } },
        ],
      },
    ],
  };

  it('summarises a product for filtering', () => {
    expect(toListingRow(source)).toEqual({
      id: 'p1',
      publishedAt: source.publishedAt,
      featuredRank: 2,
      position: 7,
      minPriceMinor: 199000n,
      fit: 'slim',
      fabric: 'Egyptian cotton',
      colors: [{ value: 'white', label: 'White', hex: '#fff' }],
      sizes: ['M', 'L'],
    });
  });

  it('skips products without variants or a publish date, and ignores unknown fits', () => {
    expect(toListingRow({ ...source, variants: [] })).toBeNull();
    expect(toListingRow({ ...source, publishedAt: null })).toBeNull();
    expect(toListingRow({ ...source, fit: 'oversized' })?.fit).toBeNull();
  });
});
