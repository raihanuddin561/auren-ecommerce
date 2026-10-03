import { slugify } from '@/modules/catalog/slug';

/** One row of the category list (the same shape listCategoryTree returns). */
export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  image: string | null;
  imageAlt: string | null;
  siblingIds: string[];
}

/** Categories can be nested this many levels deep (the server enforces the same limit). */
export const MAX_CATEGORY_LEVELS = 3;

export interface CategoryNode {
  row: CategoryRow;
  children: CategoryNode[];
}

/** Turns the flat, depth-first list into nested nodes. Order inside each level is kept. */
export function buildTree(rows: readonly CategoryRow[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(rows.map((row) => [row.id, { row, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

/** Ids of a category and everything below it. */
export function subtreeIds(rows: readonly CategoryRow[], id: string): Set<string> {
  const found = new Set<string>([id]);
  // Rows are depth first, so one pass finds every descendant.
  for (const row of rows) {
    if (row.parentId && found.has(row.parentId)) found.add(row.id);
  }
  return found;
}

/** Number of levels below a category (0 for a leaf). */
function subtreeHeight(rows: readonly CategoryRow[], id: string): number {
  const base = rows.find((row) => row.id === id)?.depth ?? 0;
  let deepest = base;
  for (const row of subtreeIds(rows, id)) {
    deepest = Math.max(deepest, rows.find((r) => r.id === row)?.depth ?? base);
  }
  return deepest - base;
}

export interface ParentOption {
  id: string;
  label: string;
  path: string;
  disabled: boolean;
}

/**
 * Choices for the parent select. When editing, the category itself and everything below it are left
 * out (a category cannot move into its own branch). Parents that would push the branch past the
 * depth limit are listed but disabled.
 */
export function parentOptions(
  rows: readonly CategoryRow[],
  editingId: string | null,
): ParentOption[] {
  const excluded = editingId ? subtreeIds(rows, editingId) : new Set<string>();
  const height = editingId ? subtreeHeight(rows, editingId) : 0;
  return rows
    .filter((row) => !excluded.has(row.id))
    .map((row) => ({
      id: row.id,
      label: `${'– '.repeat(row.depth)}${row.name}`,
      path: row.path,
      disabled: row.depth + 1 + height >= MAX_CATEGORY_LEVELS,
    }));
}

/** The storefront address a category will have, for the live preview under the slug field. */
export function previewCategoryPath(
  parentPath: string | null,
  slug: string,
  name: string,
): string | null {
  const own = slug.trim() ? slugify(slug) : slugify(name);
  if (!own) return null;
  return `/shop/${parentPath ? `${parentPath}/` : ''}${own}`;
}
