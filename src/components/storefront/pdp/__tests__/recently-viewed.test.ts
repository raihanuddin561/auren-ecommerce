import { describe, expect, it } from 'vitest';
import { withViewed, type ViewedProduct } from '../recently-viewed';

const product = (id: string): ViewedProduct => ({
  id,
  slug: `slug-${id}`,
  title: `Product ${id}`,
  imageUrl: null,
  imageAlt: null,
  dominantColor: null,
});

describe('recently viewed list', () => {
  it('puts the latest product first and removes its older entry', () => {
    const list = withViewed([product('a'), product('b'), product('c')], product('b'));
    expect(list.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps at most twelve', () => {
    let list: ViewedProduct[] = [];
    for (let index = 0; index < 20; index += 1) list = withViewed(list, product(String(index)));
    expect(list).toHaveLength(12);
    expect(list[0]?.id).toBe('19');
  });
});
