import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { LandedCostsPanel } from '@/components/admin/purchasing/landed-costs-panel';
import { PoActions } from '@/components/admin/purchasing/po-actions';
import { PoStatusBadge } from '@/components/admin/purchasing/po-status-badge';
import { ReceiveForm } from '@/components/admin/purchasing/receive-form';
import { cn } from '@/lib/cn';
import { requireStaffWith } from '@/lib/staff';
import { getPurchaseOrderForAdmin } from '@/modules/purchasing/queries';

export const metadata: Metadata = { title: 'Purchase order' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-top';

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffWith('purchasing.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getPurchaseOrderForAdmin(id);
  if (!order) notFound();

  return (
    <>
      <PageHeader
        title={order.poNumber}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <PoStatusBadge status={order.status} />
            <Link
              href={`/admin/suppliers/${order.supplier.id}`}
              className="underline decoration-gold underline-offset-4"
            >
              {order.supplier.name}
            </Link>
            <span>
              {order.expectedAt
                ? `Expected ${date.format(new Date(order.expectedAt))}`
                : 'No date set'}
            </span>
          </span>
        }
        breadcrumb={[
          { label: 'Purchase orders', href: '/admin/purchasing' },
          { label: order.poNumber },
        ]}
        actions={
          <PoActions
            id={order.id}
            poNumber={order.poNumber}
            can={order.can}
            status={order.status}
          />
        }
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="lines-heading" className="border border-line bg-raised">
          <h2 id="lines-heading" className="sr-only">
            Lines
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Purchase order lines</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Item
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Ordered
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Received
                  </th>
                  <th scope="col" className={cn(head, 'hidden text-right md:table-cell')}>
                    Unit cost
                  </th>
                  <th scope="col" className={cn(head, 'hidden text-right lg:table-cell')}>
                    Landed share
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <div className="font-medium text-fg">{line.label}</div>
                      <div className="type-small font-mono text-fg-muted">{line.sku}</div>
                    </td>
                    <td className={cn(cell, 'text-right tabular-nums')}>{line.quantityOrdered}</td>
                    <td className={cn(cell, 'text-right tabular-nums')}>
                      {line.quantityReceived}
                      {line.outstanding > 0 && order.status !== 'draft' ? (
                        <span className="block type-small text-fg-muted">
                          {line.outstanding} to come
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(cell, 'hidden text-right tabular-nums md:table-cell')}>
                      {line.unitCost}
                    </td>
                    <td className={cn(cell, 'hidden text-right tabular-nums lg:table-cell')}>
                      {line.landedShare}
                    </td>
                    <td className={cn(cell, 'text-right tabular-nums')}>{line.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 border-t border-line p-4 type-admin">
            <dt className="text-fg-muted">Goods</dt>
            <dd className="text-right tabular-nums">{order.totals.goods}</dd>
            <dt className="text-fg-muted">Landed costs</dt>
            <dd className="text-right tabular-nums">{order.totals.landed}</dd>
            <dt className="font-medium text-fg">Total</dt>
            <dd className="text-right font-medium text-fg tabular-nums">{order.totals.total}</dd>
          </dl>
        </section>

        {order.can.receive ? (
          <ReceiveForm
            poId={order.id}
            poNumber={order.poNumber}
            lines={order.lines.map((line) => ({
              id: line.id,
              label: line.label,
              sku: line.sku,
              outstanding: line.outstanding,
            }))}
          />
        ) : null}

        <LandedCostsPanel
          poId={order.id}
          costs={order.landedCosts}
          canAdd={order.can.addCost}
          canRemove={order.can.removeCost}
        />

        {order.notes ? (
          <section className="border border-line bg-raised p-5">
            <h2 className="type-h3 text-fg">Notes</h2>
            <p className="mt-2 type-admin whitespace-pre-line text-fg-muted">{order.notes}</p>
          </section>
        ) : null}

        <section aria-labelledby="receipts-heading" className="border border-line bg-raised p-5">
          <h2 id="receipts-heading" className="type-h3 text-fg">
            Deliveries
          </h2>
          {order.receipts.length === 0 ? (
            <p className="mt-2 type-admin text-fg-muted">Nothing received yet.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4">
              {order.receipts.map((receipt) => (
                <li key={receipt.id} className="border border-line p-4">
                  <p className="type-admin font-medium text-fg">
                    {dateTime.format(new Date(receipt.receivedAt))} UTC
                  </p>
                  {receipt.notes ? (
                    <p className="type-admin text-fg-muted">{receipt.notes}</p>
                  ) : null}
                  <ul className="mt-2 flex flex-col gap-1 type-admin">
                    {receipt.lines.map((line, index) => (
                      <li key={index} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {line.quantity} × {line.label}
                        </span>
                        <span className="text-fg-muted tabular-nums">
                          {line.unitCost} each + {line.landed} landed
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
