'use client';

import Link from 'next/link';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export interface CollectionListRow {
  id: string;
  title: string;
  slug: string;
  type: 'manual' | 'automatic';
  state: 'draft' | 'scheduled' | 'live';
  /** ISO timestamp, or null for a draft. */
  publishedAt: string | null;
  isFeatured: boolean;
  productCount: number;
}

function StateBadge({ row }: { row: CollectionListRow }) {
  if (row.state === 'live') return <Badge tone="success">Live</Badge>;
  if (row.state === 'draft') return <Badge tone="neutral">Draft</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone="warning">Scheduled</Badge>
      {row.publishedAt ? (
        <time
          dateTime={row.publishedAt}
          suppressHydrationWarning
          className="type-small text-fg-muted"
        >
          {new Date(row.publishedAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
      ) : null}
    </span>
  );
}

const columns: DataTableColumn<CollectionListRow>[] = [
  {
    id: 'title',
    header: 'Title',
    sortValue: (row) => row.title,
    cell: (row) => (
      <Link
        href={`/admin/collections/${row.id}`}
        className="font-medium text-fg underline-offset-4 hover:underline"
      >
        {row.title}
      </Link>
    ),
  },
  {
    id: 'slug',
    header: 'Slug',
    hideBelow: 'md',
    cell: (row) => <span className="text-fg-muted">/collections/{row.slug}</span>,
  },
  {
    id: 'type',
    header: 'Type',
    sortValue: (row) => row.type,
    cell: (row) => (
      <Badge tone="outline">{row.type === 'automatic' ? 'Automatic' : 'Manual'}</Badge>
    ),
  },
  {
    id: 'state',
    header: 'State',
    sortValue: (row) => row.state,
    cell: (row) => <StateBadge row={row} />,
  },
  {
    id: 'featured',
    header: 'Featured',
    hideBelow: 'lg',
    cell: (row) =>
      row.isFeatured ? (
        <Badge tone="gold">Featured</Badge>
      ) : (
        <span aria-label="Not featured">No</span>
      ),
  },
  {
    id: 'products',
    header: 'Products',
    align: 'end',
    sortValue: (row) => row.productCount,
    cell: (row) => row.productCount,
  },
  {
    id: 'edit',
    header: 'Edit',
    align: 'end',
    cell: (row) => (
      <Button asChild variant="link" size="none">
        <Link href={`/admin/collections/${row.id}`} aria-label={`Edit ${row.title}`}>
          Edit
        </Link>
      </Button>
    ),
  },
];

/** The collections list. Rows arrive already read by the page; sorting is done in the browser. */
export function CollectionsTable({
  rows,
  canWrite,
}: {
  rows: CollectionListRow[];
  canWrite: boolean;
}) {
  return (
    <DataTable
      caption="Collections"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      empty={
        <EmptyState
          className="border-0"
          title="No collections yet"
          description="Collections group products for the shop, such as a season or an edit of favourites."
          action={
            canWrite ? (
              <Button asChild size="sm">
                <Link href="/admin/collections/new">New collection</Link>
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}
