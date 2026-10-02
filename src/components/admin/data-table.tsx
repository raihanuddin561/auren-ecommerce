'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Download, RotateCcw } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { toCsv } from '@/lib/csv';

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  columnId: string;
  direction: SortDirection;
}

type SortValue = string | number | bigint | null | undefined;

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. For server-sorted tables it is only used to show the indicator. */
  sortValue?: (row: T) => SortValue;
  /** Plain text for CSV export. Columns without it are left out of the export. */
  exportValue?: (row: T) => string | number | bigint | null;
  align?: 'start' | 'end';
  /** Hide the column below this breakpoint. */
  hideBelow?: 'md' | 'lg';
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible name for the table. Required. */
  caption: string;
  status?: 'ready' | 'loading' | 'error';
  errorMessage?: string;
  onRetry?: () => void;
  /** Shown when there are no rows. */
  empty?: ReactNode;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Actions for the current selection (never a bulk confirm for orders: that is not allowed). */
  bulkActions?: (selected: T[]) => ReactNode;
  /** Controlled sorting for server-side sorting; leave unset for in-memory sorting. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Filters, saved views, search: rendered above the table. */
  toolbar?: ReactNode;
  exportFilename?: string;
  density?: 'comfortable' | 'compact';
  skeletonRows?: number;
}

export function compareSortValues(a: SortValue, b: SortValue): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
  }
  if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b));
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Click cycle for a column header: ascending, descending, then back to the original order. */
export function nextSort(current: SortState | null, columnId: string): SortState | null {
  if (current?.columnId !== columnId) return { columnId, direction: 'asc' };
  return current.direction === 'asc' ? { columnId, direction: 'desc' } : null;
}

const hideClass = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  status = 'ready',
  errorMessage = 'The list could not be loaded.',
  onRetry,
  empty,
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  sort: controlledSort,
  onSortChange,
  toolbar,
  exportFilename,
  density = 'comfortable',
  skeletonRows = 6,
}: DataTableProps<T>) {
  const captionId = useId();
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const [internalSelection, setInternalSelection] = useState<Set<string>>(new Set());

  const sortControlled = controlledSort !== undefined;
  const sort = sortControlled ? controlledSort : internalSort;
  const selection = selectedIds ?? internalSelection;

  const visibleRows = useMemo(() => {
    if (!sort || sortControlled) return rows;
    const column = columns.find((candidate) => candidate.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const read = column.sortValue;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareSortValues(read(a), read(b)));
  }, [rows, columns, sort, sortControlled]);

  const changeSort = (columnId: string) => {
    const next = nextSort(sort, columnId);
    if (!sortControlled) setInternalSort(next);
    onSortChange?.(next);
  };

  const changeSelection = (ids: Set<string>) => {
    if (!selectedIds) setInternalSelection(ids);
    onSelectionChange?.(ids);
  };

  const allSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selection.has(getRowId(r)));
  const someSelected = !allSelected && visibleRows.some((r) => selection.has(getRowId(r)));
  const selectedRows = visibleRows.filter((row) => selection.has(getRowId(row)));
  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3.5';

  const exportColumns = columns.filter((column) => column.exportValue);
  const downloadCsv = () => {
    const csv = toCsv(
      exportColumns.map((column) => column.header),
      visibleRows.map((row) => exportColumns.map((column) => column.exportValue!(row))),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFilename ?? 'export'}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    // Some browsers cancel the download if the URL is revoked in the same tick.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columnCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {toolbar || (exportFilename && exportColumns.length > 0) ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {exportFilename && exportColumns.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadCsv}
              disabled={status !== 'ready' || visibleRows.length === 0}
            >
              <Icon icon={Download} size={16} />
              Export CSV
            </Button>
          ) : null}
        </div>
      ) : null}

      {selectable && selectedRows.length > 0 && bulkActions ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 border border-line-strong bg-sunken px-4 py-2.5"
        >
          <p className="type-admin font-medium text-fg" aria-live="polite">
            {selectedRows.length} selected
          </p>
          {bulkActions(selectedRows)}
          <Button
            variant="link"
            className="ml-auto type-admin"
            onClick={() => changeSelection(new Set())}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      {status === 'error' ? (
        <EmptyState
          tone="error"
          title="Something went wrong"
          description={errorMessage}
          action={
            onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <Icon icon={RotateCcw} size={16} />
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          // Scrollable regions must be reachable by keyboard.
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          aria-busy={status === 'loading' || undefined}
          className="overflow-x-auto border border-line bg-raised"
        >
          <table className="w-full border-collapse type-admin">
            <caption id={captionId} className="sr-only">
              {caption}
            </caption>
            <thead className="bg-raised">
              <tr>
                {selectable ? (
                  <th scope="col" className="w-12 px-4 py-3 text-left">
                    <Checkbox
                      aria-label="Select all rows"
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      disabled={status !== 'ready' || visibleRows.length === 0}
                      onCheckedChange={(checked) =>
                        changeSelection(
                          checked === true ? new Set(visibleRows.map(getRowId)) : new Set(),
                        )
                      }
                      className="min-h-0 py-0"
                    />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const sorted = sort?.columnId === column.id ? sort.direction : null;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={
                        sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={cn(
                        'border-b border-line px-4 py-3 type-eyebrow text-fg-muted',
                        column.align === 'end' ? 'text-right' : 'text-left',
                        column.hideBelow && hideClass[column.hideBelow],
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => changeSort(column.id)}
                          className={cn(
                            'inline-flex min-h-8 items-center gap-1.5 tracking-eyebrow uppercase transition-auren-fast hover:text-fg',
                            column.align === 'end' && 'flex-row-reverse',
                          )}
                        >
                          {column.header}
                          <Icon
                            icon={
                              sorted === 'asc'
                                ? ArrowUp
                                : sorted === 'desc'
                                  ? ArrowDown
                                  : ArrowUpDown
                            }
                            size={14}
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {status === 'loading' ? (
                Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={index} className="border-b border-line last:border-b-0">
                    {Array.from({ length: columnCount }, (_, cell) => (
                      <td key={cell} className={cellPadding}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="p-0">
                    {empty ?? (
                      <EmptyState
                        title="Nothing here yet"
                        description="Items will appear here as soon as there are some."
                        className="border-0"
                      />
                    )}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const id = getRowId(row);
                  const selected = selection.has(id);
                  return (
                    <tr
                      key={id}
                      data-selected={selected || undefined}
                      className="border-b border-line transition-auren-fast last:border-b-0 hover:bg-sunken/60 data-[selected]:bg-sunken"
                    >
                      {selectable ? (
                        <td className="w-12 px-4 py-2">
                          <Checkbox
                            aria-label={`Select row ${id}`}
                            checked={selected}
                            onCheckedChange={(checked) => {
                              const next = new Set(selection);
                              if (checked === true) next.add(id);
                              else next.delete(id);
                              changeSelection(next);
                            }}
                            className="min-h-0 py-0"
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            cellPadding,
                            column.align === 'end' && 'text-right tabular-nums',
                            column.hideBelow && hideClass[column.hideBelow],
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
