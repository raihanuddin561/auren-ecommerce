import { describe, expect, it } from 'vitest';
import type { ProductView } from '../types';
import {
  describePreview,
  draftFromProduct,
  isMoneyText,
  nextOptionName,
  previewMatrix,
  type DraftOption,
} from '../variant-preview';

const draft = (name: string, labels: string[], key = name): DraftOption => ({
  key,
  name,
  values: labels.map((label) => ({ key: `${key}-${label}`, label, swatchHex: '' })),
});

const empty = { options: [], variants: [] } as unknown as Pick<ProductView, 'options' | 'variants'>;

/** A saved product: Size S, M and two variants. */
const saved = {
  options: [
    {
      id: 'o-size',
      name: 'Size',
      values: [
        { id: 'v-s', value: 's', label: 'S', swatchHex: null },
        { id: 'v-m', value: 'm', label: 'M', swatchHex: null },
      ],
    },
  ],
  variants: [
    { id: 'a', optionValueIds: ['v-s'] },
    { id: 'b', optionValueIds: ['v-m'] },
  ],
} as unknown as Pick<ProductView, 'options' | 'variants'>;

describe('previewMatrix', () => {
  it('counts the cartesian product as created variants on a new product', () => {
    const preview = previewMatrix(
      [draft('Color', ['Navy', 'Ink']), draft('Size', ['S', 'M', 'L'])],
      empty,
    );
    expect(preview).toMatchObject({ total: 6, create: 6, keep: 0, remove: 0, problems: [] });
  });

  it('keeps matching variants, creates new ones and removes the rest', () => {
    const preview = previewMatrix([draft('Size', ['M', 'L'])], saved);
    expect(preview).toMatchObject({ create: 1, keep: 1, remove: 1, total: 2 });
  });

  it('matches values by their slug, so changing the case keeps the variant', () => {
    const preview = previewMatrix([draft('Size', ['s', 'm'])], saved);
    expect(preview).toMatchObject({ create: 0, keep: 2, remove: 0 });
  });

  it('removes variants that do not have a value for a newly added option', () => {
    const preview = previewMatrix([draft('Size', ['S', 'M']), draft('Color', ['Navy'])], saved);
    expect(preview).toMatchObject({ create: 2, keep: 0, remove: 2 });
  });

  it('reports problems instead of counts', () => {
    // No options is valid: the product gets one default variant.
    expect(previewMatrix([], empty)).toMatchObject({
      total: 1,
      create: 1,
      remove: 0,
      problems: [],
    });
    expect(previewMatrix([draft('Size', [])], empty).problems.join(' ')).toMatch(
      /at least one value/,
    );
    expect(previewMatrix([draft('', ['S'])], empty).problems.join(' ')).toMatch(/needs a name/);
    expect(
      previewMatrix([draft('Size', ['S']), draft('size', ['M'], 'other')], empty).problems.join(
        ' ',
      ),
    ).toMatch(/listed twice/);
    expect(previewMatrix([draft('Size', ['S', 's'])], empty).problems.join(' ')).toMatch(/twice/);
    expect(previewMatrix([draft('Size', ['!!!'])], empty).problems.join(' ')).toMatch(
      /letters or numbers/,
    );
  });

  it('refuses a matrix above 250 variants', () => {
    const many = (name: string, n: number) =>
      draft(
        name,
        Array.from({ length: n }, (_, i) => `v${i}`),
      );
    const preview = previewMatrix([many('A', 20), many('B', 20)], empty);
    expect(preview.total).toBe(400);
    expect(preview.problems.join(' ')).toMatch(/limit is 250/);
    expect(preview.create).toBe(0);
  });

  it('flags a swatch that is not a hex colour', () => {
    const option = draft('Color', ['Navy']);
    option.values[0]!.swatchHex = 'navy';
    expect(previewMatrix([option], empty).problems.join(' ')).toMatch(/#RRGGBB/);
  });
});

describe('describePreview', () => {
  it('writes the counts as a sentence', () => {
    expect(describePreview({ total: 3, create: 1, keep: 2, remove: 0, problems: [] })).toBe(
      '1 variant will be created, 2 kept, 0 removed.',
    );
    expect(describePreview({ total: 0, create: 0, keep: 0, remove: 0, problems: ['x'] })).toMatch(
      /cannot be generated/,
    );
  });
});

describe('helpers', () => {
  it('pre-fills the draft from saved options', () => {
    const drafted = draftFromProduct(saved.options);
    expect(drafted[0]).toMatchObject({ name: 'Size', values: [{ label: 'S' }, { label: 'M' }] });
  });

  it('suggests the first unused option name', () => {
    expect(nextOptionName([])).toBe('Color');
    expect(nextOptionName([draft('Color', [])])).toBe('Size');
    expect(nextOptionName([draft('color', []), draft('SIZE', []), draft('Fit', [])])).toBe('');
  });

  it('accepts typed amounts as text without converting them', () => {
    for (const ok of ['2490', '2,490.50', '0.5']) expect(isMoneyText(ok)).toBe(true);
    for (const bad of ['', 'abc', '2490.555', '1,23', '-5']) expect(isMoneyText(bad)).toBe(false);
  });
});
