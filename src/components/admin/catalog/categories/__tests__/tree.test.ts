import { describe, expect, it } from 'vitest';
import {
  buildTree,
  parentOptions,
  previewCategoryPath,
  subtreeIds,
  type CategoryRow,
} from '../tree';

const row = (id: string, parentId: string | null, depth: number, path: string): CategoryRow => ({
  id,
  parentId,
  name: id.toUpperCase(),
  slug: path.split('/').pop()!,
  path,
  depth,
  position: 0,
  isActive: true,
  productCount: 0,
  childCount: 0,
  image: null,
  imageAlt: null,
  siblingIds: [],
});

// a > a1 > a1x ; a > a2 ; b
const rows = [
  row('a', null, 0, 'a'),
  row('a1', 'a', 1, 'a/a1'),
  row('a1x', 'a1', 2, 'a/a1/a1x'),
  row('a2', 'a', 1, 'a/a2'),
  row('b', null, 0, 'b'),
];

describe('category tree helpers', () => {
  it('nests rows under their parents in order', () => {
    const tree = buildTree(rows);
    expect(tree.map((n) => n.row.id)).toEqual(['a', 'b']);
    expect(tree[0]!.children.map((n) => n.row.id)).toEqual(['a1', 'a2']);
    expect(tree[0]!.children[0]!.children.map((n) => n.row.id)).toEqual(['a1x']);
  });

  it('finds a category and its descendants', () => {
    expect([...subtreeIds(rows, 'a1')].sort()).toEqual(['a1', 'a1x']);
  });

  it('leaves out the category and its branch from the parent choices', () => {
    const ids = parentOptions(rows, 'a1').map((o) => o.id);
    expect(ids).toEqual(['a', 'a2', 'b']);
  });

  it('disables parents that would exceed the depth limit', () => {
    const options = parentOptions(rows, null);
    expect(options.find((o) => o.id === 'a1x')!.disabled).toBe(true);
    expect(options.find((o) => o.id === 'a1')!.disabled).toBe(false);
    // Moving a branch that is already two levels tall under a depth-one parent is too deep.
    const moving = parentOptions(rows, 'a1');
    expect(moving.find((o) => o.id === 'a2')!.disabled).toBe(true);
    expect(moving.find((o) => o.id === 'b')!.disabled).toBe(false);
  });

  it('previews the storefront path', () => {
    expect(previewCategoryPath(null, '', 'Linen Shirts')).toBe('/shop/linen-shirts');
    expect(previewCategoryPath('shirts', 'Oxford', 'x')).toBe('/shop/shirts/oxford');
    expect(previewCategoryPath(null, '', '   ')).toBeNull();
  });
});
