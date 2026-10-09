import type { Metadata } from 'next';
import Link from 'next/link';
import { DecideButtons } from '@/components/admin/approvals/decide-buttons';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPrice } from '@/components/ui/price';
import { money } from '@/lib/money';
import { requireStaffWith } from '@/lib/staff';
import { getPendingApprovals } from '@/modules/approvals/queries';
import { approvalLabels } from '@/modules/orders/queries';

export const metadata: Metadata = { title: 'Approvals' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});

const KIND_LABEL: Record<string, string> = {
  refund: 'Refund',
  stock_adjustment: 'Stock adjustment',
};

export default async function ApprovalsPage() {
  const staff = await requireStaffWith('approvals.decide');
  const pending = await getPendingApprovals();
  const labels = await approvalLabels(
    pending.filter((row) => row.subjectType === 'order').map((row) => row.subjectId),
    pending.map((row) => row.requestedBy),
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description="High-value refunds and stock changes wait here for a second person. You cannot approve a request you made yourself, and an approval is good for one use."
      />
      {pending.length === 0 ? (
        <EmptyState
          title="Nothing is waiting"
          description="Requests that need a second person appear here."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((row) => (
            <li key={row.id} className="border border-line bg-raised p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="type-h3 text-fg">
                  {KIND_LABEL[row.kind] ?? row.kind}{' '}
                  <span className="tabular-nums">
                    {formatPrice(money(row.amountMinor, row.currency))}
                  </span>
                </p>
                <Badge tone="warning">Waiting</Badge>
              </div>
              <p className="mt-1 type-admin text-fg-muted">
                {row.subjectType === 'order' && labels.orders.get(row.subjectId) ? (
                  <>
                    Order{' '}
                    <Link
                      href={`/admin/orders/${row.subjectId}`}
                      className="underline decoration-gold underline-offset-4"
                    >
                      {labels.orders.get(row.subjectId)}
                    </Link>
                    {' · '}
                  </>
                ) : null}
                Asked by {labels.staff.get(row.requestedBy) ?? 'a team member'} on{' '}
                {dateTime.format(row.requestedAt)}
              </p>
              {row.reason ? <p className="mt-2 type-admin text-fg">{row.reason}</p> : null}
              <div className="mt-4">
                <DecideButtons
                  id={row.id}
                  disabledReason={
                    row.requestedBy === staff.id
                      ? 'You asked for this, so someone else must decide it.'
                      : null
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
