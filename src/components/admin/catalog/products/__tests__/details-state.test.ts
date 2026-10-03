import { describe, expect, it } from 'vitest';
import {
  addTags,
  detailsKey,
  saveStatusOf,
  shouldAutosave,
  toDetailsPayload,
  validateDetails,
  type DetailsValues,
} from '../details-state';
import { NONE } from '../select-value';

const ID = '8f14e45f-ceea-4d67-9b1a-2f3b6c9d0a11';

const values: DetailsValues = {
  title: 'Oxford Shirt',
  subtitle: '',
  slug: 'oxford-shirt',
  description: '',
  categoryId: NONE,
  sizeChartId: NONE,
  productType: '',
  fit: NONE,
  material: '',
  careInstructions: '',
  origin: '',
  tags: [],
  fabric: '',
  occasion: '',
  season: '',
  pattern: '',
  featuredRank: '',
  seoTitle: '',
  seoDescription: '',
};

describe('autosave decision', () => {
  const base = {
    enabled: true,
    dirty: true,
    valid: true,
    saving: false,
    failedKey: null,
    currentKey: 'a',
  };

  it('runs only for a changed, valid draft that is not already saving', () => {
    expect(shouldAutosave(base)).toBe(true);
    expect(shouldAutosave({ ...base, enabled: false })).toBe(false);
    expect(shouldAutosave({ ...base, dirty: false })).toBe(false);
    expect(shouldAutosave({ ...base, valid: false })).toBe(false);
    expect(shouldAutosave({ ...base, saving: true })).toBe(false);
  });

  it('does not retry the values that just failed, but does after another edit', () => {
    expect(shouldAutosave({ ...base, failedKey: 'a' })).toBe(false);
    expect(shouldAutosave({ ...base, failedKey: 'a', currentKey: 'b' })).toBe(true);
  });
});

describe('save status', () => {
  const base = { dirty: false, saving: false, failedKey: null, currentKey: 'a' };
  it('maps the form state to the status line', () => {
    expect(saveStatusOf(base)).toBe('saved');
    expect(saveStatusOf({ ...base, dirty: true })).toBe('dirty');
    expect(saveStatusOf({ ...base, dirty: true, saving: true })).toBe('saving');
    expect(saveStatusOf({ ...base, dirty: true, failedKey: 'a' })).toBe('error');
    expect(saveStatusOf({ ...base, dirty: true, failedKey: 'old' })).toBe('dirty');
  });
});

describe('payload and validation', () => {
  it('turns the none choices into null and keeps blank text for the schema to null', () => {
    const payload = toDetailsPayload(ID, values);
    expect(payload.categoryId).toBeNull();
    expect(payload.fit).toBeNull();
    expect(payload.subtitle).toBe('');
    expect(payload.attributes).toEqual({ fabric: '', occasion: '', season: '', pattern: '' });
  });

  it('accepts a form the server would accept', () => {
    expect(validateDetails(ID, values)).toEqual({});
  });

  it('reports problems on the form field names', () => {
    const errors = validateDetails(ID, {
      ...values,
      title: ' ',
      slug: 'Bad Slug!',
      fabric: 'x'.repeat(61),
      featuredRank: 'abc',
    });
    expect(Object.keys(errors).sort()).toEqual(['fabric', 'featuredRank', 'slug', 'title'].sort());
  });

  it('changes the key when anything changes', () => {
    expect(detailsKey(values)).toBe(detailsKey({ ...values }));
    expect(detailsKey(values)).not.toBe(detailsKey({ ...values, title: 'Other' }));
  });
});

describe('addTags', () => {
  it('lowercases, trims, splits on commas and ignores duplicates', () => {
    expect(addTags(['linen'], ' Summer , LINEN, oxford ').tags).toEqual([
      'linen',
      'summer',
      'oxford',
    ]);
  });

  it('refuses characters the schema refuses, keeping the rest', () => {
    const result = addTags([], 'fine, bad!');
    expect(result.tags).toEqual(['fine']);
    expect(result.error).toMatch(/letters, numbers/);
  });

  it('stops at 20 tags', () => {
    const full = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const result = addTags(full, 'one more');
    expect(result.tags).toHaveLength(20);
    expect(result.error).toMatch(/up to 20/);
  });
});
