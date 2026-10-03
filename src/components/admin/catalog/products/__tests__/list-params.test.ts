import { describe, expect, it } from 'vitest';
import { parseProductListParams, productListHref } from '../list-params';
import { isReadyToPublish, publishReadiness } from '../product-status';

const CATEGORY = '8f14e45f-ceea-4d67-9b1a-2f3b6c9d0a11';

describe('parseProductListParams', () => {
  it('uses defaults for an empty address', () => {
    expect(parseProductListParams({})).toEqual({
      q: '',
      status: undefined,
      category: undefined,
      sort: 'updated',
      page: 1,
    });
  });

  it('reads valid values and takes the first of a repeated parameter', () => {
    expect(
      parseProductListParams({
        q: ' shirt ',
        status: ['active', 'draft'],
        category: CATEGORY,
        sort: 'title',
        page: '3',
      }),
    ).toEqual({ q: 'shirt', status: 'active', category: CATEGORY, sort: 'title', page: 3 });
  });

  it('falls back instead of failing on junk', () => {
    const parsed = parseProductListParams({
      status: 'deleted',
      category: 'nope',
      sort: 'price',
      page: '-4',
      q: 'x'.repeat(200),
    });
    expect(parsed).toMatchObject({
      status: undefined,
      category: undefined,
      sort: 'updated',
      page: 1,
      q: '',
    });
    expect(parseProductListParams({ page: '2.5' }).page).toBe(1);
    expect(parseProductListParams({ page: 'abc' }).page).toBe(1);
  });
});

describe('productListHref', () => {
  it('leaves defaults out and keeps the rest', () => {
    expect(productListHref({})).toBe('/admin/products');
    expect(productListHref({ q: 'a b', status: 'draft', sort: 'title', page: 2 })).toBe(
      '/admin/products?q=a+b&status=draft&sort=title&page=2',
    );
    expect(productListHref({ sort: 'updated', page: 1 })).toBe('/admin/products');
  });
});

describe('publishReadiness', () => {
  const variant = (price: string, status: 'draft' | 'active' | 'archived' = 'active') => ({
    price,
    status,
  });
  const product = (overrides: Record<string, unknown>) =>
    ({
      variants: [variant('2490.00')],
      media: [{}],
      categoryId: CATEGORY,
      ...overrides,
    }) as Parameters<typeof publishReadiness>[0];

  it('is ready with a priced active variant, an image and a category', () => {
    expect(isReadyToPublish(publishReadiness(product({})))).toBe(true);
  });

  it('flags each missing piece', () => {
    const met = (p: Parameters<typeof publishReadiness>[0]) =>
      publishReadiness(p).map((i) => i.met);
    expect(met(product({ variants: [] }))).toEqual([false, true, true]);
    expect(met(product({ variants: [variant('0.00')] }))).toEqual([false, true, true]);
    expect(met(product({ variants: [variant('2490.00', 'draft')] }))).toEqual([false, true, true]);
    expect(met(product({ media: [] }))).toEqual([true, false, true]);
    expect(met(product({ categoryId: null }))).toEqual([true, true, false]);
  });
});
