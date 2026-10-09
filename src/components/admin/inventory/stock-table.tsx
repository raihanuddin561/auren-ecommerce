'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { AdjustStockDialog, type AdjustTarget } from './adjust-stock-dialog';
import { SetCostDialog, type SetCostTarget } from './set-cost-dialog';

export interface StockTableRow {
  variantId: string;
  productId: string;
  productTitle: string;
  optionsLabel: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  avgCost: string | null;
  hasCost: boolean;
  currency: string;
}

const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

/** Stock state is always written out as well as shown by tone. */
function StockBadge({ row }: { row: StockTableRow }) {
  if (row.available <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (row.available <= row.lowStockThreshold) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="outline">In stock</Badge>;
}

/** One row per variant: on hand, reserved, available and average cost, with an adjust action. */
export function StockTable({
  rows,
  canAdjust,
  showCost,
}: {
  rows: StockTableRow[];
  canAdjust: boolean;
  showCost: boolean;
}) {
  const [target, setTarget] = useState<AdjustTarget | null>(null);
  const [costTarget, setCostTarget] = useState<SetCostTarget | null>(null);
  return (
    <>
      <div className="overflow-x-auto border border-line bg-raised">
        <table className="w-full border-collapse type-admin">
          <caption className="sr-only">Stock levels by variant</caption>
          <thead>
            <tr>
              <th scope="col" className={head}>
                Product
              </th>
              <th scope="col" className={cn(head, 'hidden md:table-cell')}>
                SKU
              </th>
              <th scope="col" className={cn(head, 'text-right')}>
                On hand
              </th>
              <th scope="col" className={cn(head, 'hidden text-right sm:table-cell')}>
                Reserved
              </th>
              <th scope="col" className={cn(head, 'text-right')}>
                Available
              </th>
              {showCost ? (
                <th scope="col" className={cn(head, 'hidden text-right lg:table-cell')}>
                  Avg cost
                </th>
              ) : null}
              <th scope="col" className={head}>
                Status
              </th>
              <th scope="col" className={head}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const title = row.optionsLabel
                ? `${row.productTitle} / ${row.optionsLabel}`
                : row.productTitle;
              return (
                <tr key={row.variantId} className="border-b border-line last:border-b-0">
                  <td className={cell}>
                    <Link
                      href={`/admin/products/${row.productId}`}
                      className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                    >
                      {row.productTitle}
                    </Link>
                    {row.optionsLabel ? (
                      <div className="type-small text-fg-muted">{row.optionsLabel}</div>
                    ) : null}
                  </td>
                  <td className={cn(cell, 'hidden font-mono md:table-cell')}>{row.sku}</td>
                  <td className={cn(cell, 'text-right tabular-nums')}>{row.onHand}</td>
                  <td className={cn(cell, 'hidden text-right tabular-nums sm:table-cell')}>
                    {row.reserved}
                  </td>
                  <td className={cn(cell, 'text-right font-medium tabular-nums')}>
                    {row.available}
                  </td>
                  {showCost ? (
                    <td className={cn(cell, 'hidden text-right tabular-nums lg:table-cell')}>
                      {row.hasCost ? (
                        (row.avgCost ?? <span className="text-fg-muted">Set</span>)
                      ) : (
                        <span className="text-fg-muted">No cost yet</span>
                      )}
                    </td>
                  ) : null}
                  <td className={cell}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StockBadge row={row} />
                      {row.hasCost ? null : <Badge tone="danger">No cost</Badge>}
                    </div>
                    {row.hasCost ? null : (
                      <p className="mt-1 type-small text-fg-muted">Cannot be ordered</p>
                    )}
                  </td>
                  <td className={cn(cell, 'text-right whitespace-nowrap')}>
                    <Button asChild variant="ghost" size="sm" className="min-h-11">
                      <Link
                        href={`/admin/inventory/movements?variant=${row.variantId}`}
                        aria-label={`History for ${title}`}
                      >
                        History
                      </Link>
                    </Button>
                    {canAdjust && !row.hasCost ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="min-h-11"
                        aria-label={`Set cost for ${title}`}
                        onClick={() =>
                          setCostTarget({
                            variantId: row.variantId,
                            productId: row.productId,
                            productTitle: row.productTitle,
                            currency: row.currency,
                            title,
                          })
                        }
                      >
                        Set cost
                      </Button>
                    ) : null}
                    {canAdjust ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11"
                        aria-label={`Adjust stock for ${title}`}
                        onClick={() =>
                          setTarget({
                            variantId: row.variantId,
                            title,
                            onHand: row.onHand,
                            reserved: row.reserved,
                            hasCost: row.hasCost,
                            currency: row.currency,
                          })
                        }
                      >
                        Adjust
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdjustStockDialog target={target} onClose={() => setTarget(null)} />
      <SetCostDialog target={costTarget} onClose={() => setCostTarget(null)} />
    </>
  );
}
