import { describe, expect, it } from 'vitest';
import {
  clearRedirectCache,
  isRedirectablePath,
  isSafeRedirectTarget,
  readRedirectSnapshot,
  staleRedirectSnapshot,
  writeRedirectSnapshot,
} from '../redirect-cache';
import {
  createCategorySchema,
  createCollectionSchema,
  createSizeChartSchema,
  generateVariantsSchema,
  moneyText,
  productDetailsSchema,
  updateMediaSchema,
  updateVariantsSchema,
} from '../schemas';

const uuid = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';

describe('strict inputs (INV-A1)', () => {
  it('rejects unknown keys on every schema', () => {
    expect(
      createCategorySchema.safeParse({
        name: 'Shirts',
        slug: '',
        parentId: null,
        description: '',
        isActive: true,
        seoTitle: '',
        seoDescription: '',
        role: 'owner',
      }).success,
    ).toBe(false);
    expect(
      updateMediaSchema.safeParse({ id: uuid, alt: 'x', optionValueId: null, extra: 1 }).success,
    ).toBe(false);
  });
});

describe('money text', () => {
  it('accepts amounts typed by a person and rejects the rest', () => {
    for (const ok of ['2490', '2,490', '2490.5', '2,490.50', '0']) {
      expect(moneyText.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ['', '-5', '12.345', 'abc', '1,23', '1e3', ' ']) {
      expect(moneyText.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('category input', () => {
  const base = {
    name: ' Shirts ',
    slug: '',
    parentId: null,
    description: '',
    isActive: true,
    seoTitle: '',
    seoDescription: '',
  };

  it('trims, and turns blank optional fields into null', () => {
    const parsed = createCategorySchema.parse(base);
    expect(parsed.name).toBe('Shirts');
    expect(parsed.slug).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it('refuses a malformed slug and an over-long SEO title', () => {
    expect(createCategorySchema.safeParse({ ...base, slug: 'Not A Slug' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ ...base, seoTitle: 'x'.repeat(71) }).success).toBe(
      false,
    );
  });
});

describe('product details input', () => {
  const valid = {
    id: uuid,
    title: 'Oxford shirt',
    subtitle: '',
    description: '',
    slug: 'oxford-shirt',
    categoryId: null,
    sizeChartId: null,
    productType: 'shirt',
    material: '',
    careInstructions: '',
    fit: 'regular',
    origin: '',
    tags: ['linen', 'summer'],
    attributes: { fabric: 'Cotton', occasion: '', season: '', pattern: '' },
    featuredRank: '',
    seoTitle: '',
    seoDescription: '',
  };

  it('accepts a complete form and normalises blanks', () => {
    const parsed = productDetailsSchema.parse(valid);
    expect(parsed.subtitle).toBeNull();
    expect(parsed.featuredRank).toBeNull();
    expect(parsed.attributes.occasion).toBeNull();
  });

  it('rejects bad tags, slugs and fits', () => {
    expect(productDetailsSchema.safeParse({ ...valid, tags: ['Bad_Tag!'] }).success).toBe(false);
    expect(productDetailsSchema.safeParse({ ...valid, slug: 'Oxford Shirt' }).success).toBe(false);
    expect(productDetailsSchema.safeParse({ ...valid, fit: 'baggy' }).success).toBe(false);
  });
});

describe('variants', () => {
  it('caps options at three and requires a price', () => {
    const option = { name: 'Size', values: [{ label: 'S', swatchHex: '' }] };
    const base = {
      productId: uuid,
      options: [option],
      defaults: { price: '2490', compareAt: '', weightG: '', skuPrefix: 'AUR' },
    };
    expect(generateVariantsSchema.safeParse(base).success).toBe(true);
    expect(
      generateVariantsSchema.safeParse({ ...base, options: [option, option, option, option] })
        .success,
    ).toBe(false);
    expect(
      generateVariantsSchema.safeParse({ ...base, defaults: { ...base.defaults, price: '' } })
        .success,
    ).toBe(false);
  });

  it('validates SKU and swatch shapes', () => {
    const row = {
      id: uuid,
      sku: 'AUR-1',
      barcode: '',
      price: '100',
      compareAt: '',
      weightG: '',
      status: 'active',
    };
    expect(updateVariantsSchema.safeParse({ productId: uuid, variants: [row] }).success).toBe(true);
    expect(
      updateVariantsSchema.safeParse({ productId: uuid, variants: [{ ...row, sku: 'bad sku' }] })
        .success,
    ).toBe(false);
    expect(updateVariantsSchema.safeParse({ productId: uuid, variants: [] }).success).toBe(false);
    expect(
      generateVariantsSchema.safeParse({
        productId: uuid,
        options: [{ name: 'Colour', values: [{ label: 'Navy', swatchHex: 'navy' }] }],
        defaults: { price: '1', compareAt: '', weightG: '', skuPrefix: '' },
      }).success,
    ).toBe(false);
  });
});

describe('whole numbers typed into forms', () => {
  it('accepts digits for weight and featured rank and rejects other text', () => {
    const row = {
      id: uuid,
      sku: 'AUR-1',
      barcode: '',
      price: '100',
      compareAt: '',
      status: 'active',
    };
    const ok = (weightG: string) =>
      updateVariantsSchema.safeParse({ productId: uuid, variants: [{ ...row, weightG }] }).success;
    expect(ok('250')).toBe(true);
    expect(ok('')).toBe(true);
    for (const bad of ['1e3', '0x10', '+5', '-1', 'abc', '12.5']) expect(ok(bad), bad).toBe(false);
  });
});

describe('media', () => {
  it('requires alt text', () => {
    expect(updateMediaSchema.safeParse({ id: uuid, alt: '   ', optionValueId: null }).success).toBe(
      false,
    );
    expect(
      updateMediaSchema.safeParse({
        id: uuid,
        alt: 'Navy oxford shirt, front',
        optionValueId: null,
      }).success,
    ).toBe(true);
  });
});

describe('size charts', () => {
  const chart = {
    name: 'Shirts',
    unit: 'cm',
    columns: ['Chest', 'Waist'],
    rows: [
      { size: 'S', values: ['96', '82'] },
      { size: 'M', values: ['102', '88'] },
    ],
    howToMeasure: '',
    modelInfo: '',
  };

  it('accepts a rectangular chart', () => {
    expect(createSizeChartSchema.safeParse(chart).success).toBe(true);
  });

  it('rejects a row with the wrong number of values and duplicate sizes', () => {
    expect(
      createSizeChartSchema.safeParse({ ...chart, rows: [{ size: 'S', values: ['96'] }] }).success,
    ).toBe(false);
    expect(
      createSizeChartSchema.safeParse({
        ...chart,
        rows: [
          { size: 'S', values: ['1', '2'] },
          { size: 's', values: ['3', '4'] },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('collections', () => {
  const base = {
    title: 'Linen edit',
    slug: '',
    description: '',
    type: 'manual',
    rules: { match: 'all', conditions: [] },
    sortOrder: 'manual',
    publishedAt: '',
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
  };

  it('needs at least one rule for an automatic collection', () => {
    expect(createCollectionSchema.safeParse(base).success).toBe(true);
    expect(createCollectionSchema.safeParse({ ...base, type: 'automatic' }).success).toBe(false);
    expect(
      createCollectionSchema.safeParse({
        ...base,
        type: 'automatic',
        rules: { match: 'any', conditions: [{ field: 'tag', operator: 'equals', value: 'linen' }] },
      }).success,
    ).toBe(true);
  });

  it('checks rule values per field', () => {
    const rules = (condition: object) => ({ match: 'all', conditions: [condition] });
    const automatic = (condition: object) =>
      createCollectionSchema.safeParse({ ...base, type: 'automatic', rules: rules(condition) })
        .success;
    expect(automatic({ field: 'price', operator: 'less_than', value: '5000' })).toBe(true);
    expect(automatic({ field: 'price', operator: 'less_than', value: 'cheap' })).toBe(false);
    expect(automatic({ field: 'price', operator: 'equals', value: '5000' })).toBe(false);
    expect(automatic({ field: 'category', operator: 'equals', value: 'shirts' })).toBe(false);
    expect(automatic({ field: 'category', operator: 'equals', value: uuid })).toBe(true);
    expect(automatic({ field: 'fit', operator: 'equals', value: 'baggy' })).toBe(false);
  });

  it('treats null, empty and ISO publish dates as valid and other text as invalid', () => {
    expect(createCollectionSchema.safeParse({ ...base, publishedAt: null }).success).toBe(true);
    expect(
      createCollectionSchema.safeParse({ ...base, publishedAt: '2026-11-01T09:00:00.000Z' })
        .success,
    ).toBe(true);
    expect(createCollectionSchema.safeParse({ ...base, publishedAt: 'tomorrow' }).success).toBe(
      false,
    );
  });
});

describe('redirect snapshot', () => {
  it('recognises storefront paths that can be redirected', () => {
    expect(isRedirectablePath('/products/oxford-shirt')).toBe(true);
    expect(isRedirectablePath('/collections/linen')).toBe(true);
    expect(isRedirectablePath('/shop/shirts/oxford')).toBe(true);
    expect(isRedirectablePath('/admin/products')).toBe(false);
    expect(isRedirectablePath('/')).toBe(false);
  });

  it('keeps the whole table until it expires or is cleared', () => {
    clearRedirectCache();
    expect(readRedirectSnapshot(0)).toBeUndefined();
    writeRedirectSnapshot([{ fromPath: '/products/a', toPath: '/products/b', statusCode: 301 }], 0);
    expect(readRedirectSnapshot(1_000)?.get('/products/a')).toEqual({
      to: '/products/b',
      status: 301,
    });
    expect(readRedirectSnapshot(1_000)?.get('/products/zzz')).toBeUndefined();
    expect(readRedirectSnapshot(16_000)).toBeUndefined();
    expect(staleRedirectSnapshot()?.size).toBe(1);
    clearRedirectCache();
    expect(readRedirectSnapshot(1_000)).toBeUndefined();
  });

  it('refuses targets that leave the site or point at themselves', () => {
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example/x',
      'products/x',
      '/a b',
    ]) {
      expect(isSafeRedirectTarget(bad), bad).toBe(false);
    }
    expect(isSafeRedirectTarget('/products/oxford-shirt')).toBe(true);
    const map = writeRedirectSnapshot(
      [
        { fromPath: '/products/a', toPath: '//evil.example', statusCode: 301 },
        { fromPath: '/products/b', toPath: '/products/b', statusCode: 301 },
        { fromPath: '/products/c', toPath: '/products/d', statusCode: 302 },
      ],
      0,
    );
    expect([...map.keys()]).toEqual(['/products/c']);
    expect(map.get('/products/c')?.status).toBe(302);
    clearRedirectCache();
  });
});
