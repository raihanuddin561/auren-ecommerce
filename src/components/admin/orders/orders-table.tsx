'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPrice } from '@/components/ui/price';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { bulkBookCourierAction, bulkStartPickingAction } from '@/modules/orders/list-actions';
import type { AdminOrderRow } from '@/modules/orders/admin-types';
import { CHANNEL_LABEL } from '@/modules/orders/schemas';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

/** Orders that a person has confirmed and that are not shipped yet: the only ones bulk actions touch. */
const SELECTABLE = new Set(['confirmed', 'processing']);

/**
 * The orders list. Bulk print and bulk booking apply to confirmed orders only: the checkbox is
 * disabled for anything else, and the server refuses it again. There is no bulk confirm anywhere.
 */
export function OrdersTable({
  rows,
  canFulfil,
  canShip,
  apiCouriers,
}: {
  rows: AdminOrderRow[];
  canFulfil: boolean;
  canShip: boolean;
  apiCouriers: Array<{ id: 'pathao' | 'steadfast'; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = useMemo(() => rows.filter((row) => SELECTABLE.has(row.status)), [rows]);
  const ids = [...selected].join(',');

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function startPicking() {
    startTransition(async () => {
      const result = await bulkStartPickingAction({ orderIds: [...selected] });
      if (result.ok) {
        toast.success(
          `${result.data.started} ${result.data.started === 1 ? 'order' : 'orders'} moved to picking`,
          result.data.skipped.length > 0 ? `${result.data.skipped.length} skipped.` : undefined,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error('Could not start picking', result.error.message);
      }
    });
  }

  function book(courier: 'pathao' | 'steadfast') {
    startTransition(async () => {
      const result = await bulkBookCourierAction({ orderIds: [...selected], courier });
      if (result.ok) {
        toast.success(
          `${result.data.booked} parcels booked`,
          result.data.failed.length > 0
            ? `${result.data.failed.length} could not be booked: ${result.data.failed[0]?.reason}`
            : undefined,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error('Could not book', result.error.message);
      }
    });
  }

  return (
    <>
      {canFulfil && selectable.length > 0 ? (
        <div
          role="region"
          aria-label="Actions for the selected orders"
          className="mb-3 flex flex-wrap items-center gap-2 border border-line bg-raised px-4 py-3"
        >
          <span className="type-admin text-fg-muted">
            {selected.size === 0
              ? `Tick confirmed orders to print or ship them together (${selectable.length} on this page).`
              : `${selected.size} selected`}
          </span>
          {selected.size > 0 ? (
            <>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={`/admin/orders/print?kind=packing_slip&ids=${ids}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Print packing slips
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={`/admin/orders/print?kind=invoice&ids=${ids}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Print invoices
                </a>
              </Button>
              <Button size="sm" variant="secondary" loading={pending} onClick={startPicking}>
                Start picking
              </Button>
              {canShip
                ? apiCouriers.map((courier) => (
                    <Button
                      key={courier.id}
                      size="sm"
                      loading={pending}
                      onClick={() => book(courier.id)}
                    >
                      Book with {courier.label}
                    </Button>
                  ))
                : null}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto border border-line bg-raised">
        <table className="w-full border-collapse type-admin">
          <caption className="sr-only">Orders</caption>
          <thead>
            <tr>
              {canFulfil ? (
                <th scope="col" className={cn(head, 'w-10')}>
                  <span className="sr-only">Select</span>
                </th>
              ) : null}
              <th scope="col" className={head}>
                Order
              </th>
              <th scope="col" className={head}>
                Customer
              </th>
              <th scope="col" className={head}>
                Status
              </th>
              <th scope="col" className={cn(head, 'hidden text-right sm:table-cell')}>
                Items
              </th>
              <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
                Payment
              </th>
              <th scope="col" className={cn(head, 'text-right')}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canSelect = SELECTABLE.has(row.status);
              return (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  {canFulfil ? (
                    <td className={cell}>
                      <Checkbox
                        aria-label={`Select ${row.orderNumber}`}
                        checked={selected.has(row.id)}
                        disabled={!canSelect}
                        title={canSelect ? undefined : 'Only confirmed orders can be selected'}
                        onCheckedChange={(value) => toggle(row.id, value === true)}
                      />
                    </td>
                  ) : null}
                  <td className={cell}>
                    <Link
                      href={`/admin/orders/${row.id}`}
                      className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                    >
                      {row.orderNumber}
                    </Link>
                    <div className="type-small text-fg-muted">
                      {dateTime.format(new Date(row.placedAt))}
                      {row.channel !== 'web'
                        ? ` · ${CHANNEL_LABEL[row.channel] ?? row.channel}`
                        : ''}
                    </div>
                  </td>
                  <td className={cell}>
                    <div>{row.customerName}</div>
                    <div className="type-small text-fg-muted">{row.phone}</div>
                  </td>
                  <td className={cell}>
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={row.status} />
                      {row.riskFlags.length > 0 ? (
                        <Badge tone="outline">
                          {row.riskFlags.length} {row.riskFlags.length === 1 ? 'flag' : 'flags'}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className={cn(cell, 'hidden text-right tabular-nums sm:table-cell')}>
                    {row.itemCount}
                  </td>
                  <td className={cn(cell, 'hidden capitalize lg:table-cell')}>
                    {row.paymentStatus.replaceAll('_', ' ')}
                  </td>
                  <td className={cn(cell, 'text-right tabular-nums')}>
                    {formatPrice(deserialize(row.total))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
