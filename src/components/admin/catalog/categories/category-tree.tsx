'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DragEvent } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { SortableList } from '@/components/admin/sortable-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { reorderCategories } from '@/modules/catalog/actions';
import { buildTree, MAX_CATEGORY_LEVELS, type CategoryNode, type CategoryRow } from './tree';

interface CategoryTreeProps {
  rows: CategoryRow[];
  canWrite: boolean;
}

/** Nested drags must not reach the parent row's own drag handlers. */
const contain = (event: DragEvent) => event.stopPropagation();

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function CategoryRowView({ row, canWrite }: { row: CategoryRow; canWrite: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/categories/${row.id}`}
            className="type-admin font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
          >
            {row.name}
          </Link>
          <Badge tone={row.isActive ? 'success' : 'outline'}>
            {row.isActive ? 'Active' : 'Hidden'}
          </Badge>
        </p>
        <p className="mt-1 type-small break-all text-fg-muted">
          /shop/{row.path} · {plural(row.productCount, 'product', 'products')}
          {row.childCount > 0
            ? ` · ${plural(row.childCount, 'sub-category', 'sub-categories')}`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {canWrite && row.depth + 1 < MAX_CATEGORY_LEVELS ? (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`/admin/categories/new?parent=${row.id}`}
              aria-label={`Add a sub-category to ${row.name}`}
            >
              Add sub-category
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/categories/${row.id}`} aria-label={`Edit ${row.name}`}>
            Edit
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** The whole tree: each group of siblings can be reordered on its own. */
export function CategoryTree({ rows, canWrite }: CategoryTreeProps) {
  const router = useRouter();
  const tree = buildTree(rows);

  async function reorder(parentId: string | null, orderedIds: string[]): Promise<boolean> {
    const result = await reorderCategories({ parentId, orderedIds });
    if (!result.ok) {
      toast.error(failureMessage(result) ?? 'The order could not be saved.');
      return false;
    }
    toast.success('Order saved');
    router.refresh();
    return true;
  }

  // A plain function (not a component) so the lists keep their state between renders.
  function renderLevel(nodes: CategoryNode[], parent: CategoryNode | null) {
    const label = parent ? `Sub-categories of ${parent.row.name}` : 'Top-level categories';
    const content = (node: CategoryNode) => (
      <>
        <CategoryRowView row={node.row} canWrite={canWrite} />
        {node.children.length > 0 ? (
          <div
            className="mt-3 ml-3 border-l border-line pl-3 md:ml-5 md:pl-5"
            onDragStart={contain}
            onDragOver={contain}
            onDrop={contain}
            onDragEnd={contain}
          >
            {renderLevel(node.children, node)}
          </div>
        ) : null}
      </>
    );

    if (canWrite && nodes.length > 1) {
      return (
        <SortableList
          label={label}
          items={nodes.map((node) => ({
            id: node.row.id,
            label: node.row.name,
            content: content(node),
          }))}
          onReorder={(ids) => reorder(parent?.row.id ?? null, ids)}
        />
      );
    }
    return (
      <ul aria-label={label} className="flex flex-col gap-2">
        {nodes.map((node) => (
          <li key={node.row.id} className={cn('border border-line bg-raised p-3')}>
            {content(node)}
          </li>
        ))}
      </ul>
    );
  }

  return renderLevel(tree, null);
}
