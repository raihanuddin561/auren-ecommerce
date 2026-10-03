import { describe, expect, it } from 'vitest';
import {
  isSelected,
  MAX_PRODUCTS_PER_ADD,
  toggleSelected,
  withoutMembers,
  type PickerProduct,
} from '../picker-state';

const product = (id: string): PickerProduct => ({
  id,
  title: `Product ${id}`,
  status: 'active',
  imageUrl: null,
});

describe('picker selection', () => {
  it('selects and unselects a product', () => {
    const one = toggleSelected([], product('a'));
    expect(isSelected(one, 'a')).toBe(true);
    expect(toggleSelected(one, product('a'))).toEqual([]);
  });

  it('keeps earlier choices when more are made', () => {
    const list = toggleSelected(toggleSelected([], product('a')), product('b'));
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('does not change the list it was given', () => {
    const start = [product('a')];
    toggleSelected(start, product('b'));
    expect(start).toHaveLength(1);
  });

  it('stops adding at the limit of one add, but still lets a product be removed', () => {
    let list: PickerProduct[] = [];
    for (let i = 0; i < MAX_PRODUCTS_PER_ADD + 2; i++)
      list = toggleSelected(list, product(`p${i}`));
    expect(list).toHaveLength(MAX_PRODUCTS_PER_ADD);
    expect(toggleSelected(list, product('p0'))).toHaveLength(MAX_PRODUCTS_PER_ADD - 1);
  });

  it('drops chosen products that have become members', () => {
    const list = [product('a'), product('b'), product('c')];
    expect(withoutMembers(list, ['b']).map((p) => p.id)).toEqual(['a', 'c']);
    expect(withoutMembers(list, [])).toHaveLength(3);
  });
});
