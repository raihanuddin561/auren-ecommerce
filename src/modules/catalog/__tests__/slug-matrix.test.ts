import { describe, expect, it } from 'vitest';
import {
  combinationKey,
  combinations,
  dedupeSku,
  planMatrix,
  skuFor,
  type MatrixOption,
} from '../matrix';
import { isValidSlug, slugify, uniqueSlug } from '../slug';
import { catalogTags } from '../tags';

describe('slugify', () => {
  it('folds accents, drops punctuation and joins words with single hyphens', () => {
    expect(slugify('Oxford Shirt, Sky Blue!')).toBe('oxford-shirt-sky-blue');
    expect(slugify('  Café   Linen  ')).toBe('cafe-linen');
    expect(slugify('Tailoring & Suits')).toBe('tailoring-and-suits');
  });

  it('never ends or starts with a hyphen and respects the length limit', () => {
    expect(slugify('---a---')).toBe('a');
    const long = slugify('x'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(isValidSlug(long)).toBe(true);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
    expect(isValidSlug('')).toBe(false);
  });

  it('validates slugs', () => {
    expect(isValidSlug('oxford-shirt-2')).toBe(true);
    expect(isValidSlug('Oxford')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('-a')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('appends a counter until the slug is free', async () => {
    const taken = new Set(['linen-shirt', 'linen-shirt-2']);
    expect(await uniqueSlug('Linen Shirt', async (s) => taken.has(s))).toBe('linen-shirt-3');
    expect(await uniqueSlug('Wool Blazer', async (s) => taken.has(s))).toBe('wool-blazer');
  });

  it('falls back to a generic base for titles without letters', async () => {
    expect(await uniqueSlug('???', async () => false)).toBe('item');
  });
});

const colour: MatrixOption = {
  name: 'Colour',
  values: [
    { value: 'navy', label: 'Navy' },
    { value: 'white', label: 'White' },
  ],
};
const size: MatrixOption = {
  name: 'Size',
  values: [
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
  ],
};

describe('variant matrix', () => {
  it('builds the cartesian product with the first option varying slowest', () => {
    const combos = combinations([colour, size]);
    expect(combos).toHaveLength(6);
    expect(combos.map((c) => c.values.join('/'))).toEqual([
      'navy/s',
      'navy/m',
      'navy/l',
      'white/s',
      'white/m',
      'white/l',
    ]);
    expect(combos[1]!.labels).toEqual(['Navy', 'M']);
  });

  it('has no combinations without options', () => {
    expect(combinations([])).toEqual([]);
  });

  it('plans create, keep and remove against existing variants', () => {
    const existing = [
      { id: 'v1', values: ['navy', 's'] },
      { id: 'v2', values: ['navy', 'xl'] },
      { id: 'v3', values: ['white', 'm'] },
    ];
    const plan = planMatrix([colour, size], existing);
    expect(plan.keep.sort()).toEqual(['v1', 'v3']);
    expect(plan.remove).toEqual(['v2']);
    expect(plan.create.map((c) => c.values.join('/'))).toEqual([
      'navy/m',
      'navy/l',
      'white/s',
      'white/l',
    ]);
  });

  it('keeps everything when the matrix is unchanged', () => {
    const existing = combinations([colour, size]).map((c, i) => ({
      id: `v${i}`,
      values: c.values,
    }));
    const plan = planMatrix([colour, size], existing);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.keep).toHaveLength(6);
  });

  it('plans one default variant for a product without options', () => {
    expect(planMatrix([], [])).toEqual({
      create: [{ values: [], labels: [] }],
      keep: [],
      remove: [],
    });
    const plan = planMatrix(
      [],
      [
        { id: 'a', values: [] },
        { id: 'b', values: [] },
      ],
    );
    expect(plan).toEqual({ create: [], keep: ['a'], remove: ['b'] });
  });

  it('keys combinations without collisions', () => {
    expect(combinationKey(['a', 'bc'])).not.toBe(combinationKey(['ab', 'c']));
  });
});

describe('SKUs', () => {
  it('builds readable upper-case SKUs', () => {
    expect(skuFor('Oxford Shirt', ['navy', 'm'])).toBe('OXFORDSH-NAVY-M');
    expect(skuFor('AUR', ['sky-blue', 'xl'])).toBe('AUR-SKYB-XL');
  });

  it('adds a counter when the SKU is taken', () => {
    expect(dedupeSku('AUR-NAVY-M', new Set(['AUR-NAVY-M']))).toBe('AUR-NAVY-M-2');
    expect(dedupeSku('AUR-NAVY-M', new Set(['AUR-NAVY-M', 'AUR-NAVY-M-2']))).toBe('AUR-NAVY-M-3');
    expect(dedupeSku('FREE', new Set())).toBe('FREE');
  });
});

describe('cache tags', () => {
  it('always include the sitemap and feeds and one tag pair per entity', () => {
    const tags = catalogTags({ products: ['p1'], collections: ['c1'], categories: ['k1'] });
    expect(tags).toEqual(
      expect.arrayContaining([
        'sitemap',
        'feeds',
        'product:p1',
        'products',
        'collection:c1',
        'collections',
        'category:k1',
        'categories',
      ]),
    );
  });

  it('does not invent tags for entities that were not touched', () => {
    expect(catalogTags({ products: ['p1'] })).not.toContain('collections');
  });
});
