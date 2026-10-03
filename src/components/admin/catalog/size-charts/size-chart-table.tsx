'use client';

import Link from 'next/link';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export interface SizeChartListRow {
  id: string;
  name: string;
  unit: 'cm' | 'in';
  sizes: number;
  measurements: number;
  productCount: number;
}

export function SizeChartTable({
  rows,
  canWrite,
}: {
  rows: SizeChartListRow[];
  canWrite: boolean;
}) {
  const columns: DataTableColumn<SizeChartListRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (row) => row.name,
      cell: (row) => (
        <Link
          href={`/admin/size-charts/${row.id}`}
          className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
        >
          {row.name}
        </Link>
      ),
    },
    { id: 'unit', header: 'Unit', cell: (row) => row.unit },
    {
      id: 'sizes',
      header: 'Sizes',
      align: 'end',
      sortValue: (row) => row.sizes,
      cell: (row) => row.sizes,
    },
    {
      id: 'measurements',
      header: 'Measurements',
      align: 'end',
      hideBelow: 'md',
      sortValue: (row) => row.measurements,
      cell: (row) => row.measurements,
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
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/size-charts/${row.id}`} aria-label={`Edit ${row.name}`}>
            Edit
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      caption="Size charts"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      empty={
        <EmptyState
          title="No size charts yet"
          description="A size chart tells shoppers which size to choose. Create one, then assign it to products."
          className="border-0"
          action={
            canWrite ? (
              <Button asChild size="sm">
                <Link href="/admin/size-charts/new">New size chart</Link>
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}
