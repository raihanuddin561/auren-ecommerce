import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { VerificationWorkspace } from '@/components/admin/orders/verification-workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { minutesText } from '@/modules/orders/sla';
import {
  FILTER_LABEL,
  QUEUE_FILTERS,
  getVerificationQueue,
  getVerificationWorkspace,
  listVerifierStaff,
  type QueueFilter,
} from '@/modules/orders/queries';
import { getDivisionsAndDistricts } from '@/modules/shipping/queries';

export const metadata: Metadata = { title: 'Verification queue' };

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: 'short',
  timeZone: 'Asia/Dhaka',
});

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function VerificationPage({
  searchParams,
}: PageProps<'/admin/orders/verification'>) {
  const staff = await requireStaffWith('orders.verify');
  const raw = await searchParams;
  const filter = (QUEUE_FILTERS.find((name) => name === one(raw.filter)) ?? 'all') as QueueFilter;
  const manager = hasPermission(staff, 'approvals.decide') && hasPermission(staff, 'orders.update');
  const viewer = { staffId: staff.id, manager };

  const queue = await getVerificationQueue(filter, viewer);
  const requested = one(raw.order);
  const selected =
    queue.rows.find((row) => row.id === requested)?.id ??
    (requested && /^[0-9a-f-]{36}$/.test(requested) ? requested : (queue.rows[0]?.id ?? null));
  const formatTotal = (value: Parameters<typeof deserialize>[0]) => formatPrice(deserialize(value));
  const [workspace, areas, assignable] = await Promise.all([
    selected ? getVerificationWorkspace(selected, viewer, formatTotal) : Promise.resolve(null),
    getDivisionsAndDistricts(),
    manager ? listVerifierStaff() : Promise.resolve([]),
  ]);

  const hrefFor = (orderId: string, nextFilter: QueueFilter = filter) => {
    const params = new URLSearchParams();
    if (nextFilter !== 'all') params.set('filter', nextFilter);
    params.set('order', orderId);
    return `/admin/orders/verification?${params.toString()}`;
  };
  const index = queue.rows.findIndex((row) => row.id === workspace?.id);
  const navigation = {
    previousId: index > 0 ? (queue.rows[index - 1]?.id ?? null) : null,
    nextId: index >= 0 ? (queue.rows[index + 1]?.id ?? null) : null,
  };

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Every order waits here until a team member has spoken to the customer and confirmed it. Nothing is confirmed or cancelled automatically."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/orders/new">Enter an order</Link>
          </Button>
        }
      />

      <nav aria-label="Filter the queue" className="mb-5 flex flex-wrap gap-2">
        {QUEUE_FILTERS.filter((name) => name !== 'needs_review' || manager).map((name) => (
          <Button key={name} asChild size="sm" variant={name === filter ? 'primary' : 'secondary'}>
            <Link
              href={`/admin/orders/verification${name === 'all' ? '' : `?filter=${name}`}`}
              aria-current={name === filter ? 'page' : undefined}
            >
              {FILTER_LABEL[name]} ({queue.counts[name]})
            </Link>
          </Button>
        ))}
      </nav>

      {queue.rows.length === 0 && !workspace ? (
        <EmptyState
          title={filter === 'all' ? 'The queue is clear' : 'No orders match this filter'}
          description={
            filter === 'all'
              ? 'New orders appear here the moment a customer places them or your team enters one.'
              : 'Try another filter.'
          }
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <section
            aria-label="Orders waiting"
            className="border border-line bg-raised xl:sticky xl:top-4"
          >
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {queue.rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={hrefFor(row.id)}
                    aria-current={row.id === workspace?.id ? 'true' : undefined}
                    className={cn(
                      'flex flex-col gap-1.5 px-4 py-3 transition-auren-fast hover:bg-fg/5',
                      row.id === workspace?.id && 'bg-fg/8',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium text-fg">{row.orderNumber}</span>
                      <span
                        className={cn(
                          'type-small tabular-nums',
                          row.sla.overdue ? 'font-medium text-danger-text' : 'text-accent-text',
                        )}
                      >
                        {row.sla.overdue
                          ? `Overdue ${minutesText(row.sla.remainingMinutes)}`
                          : `${minutesText(row.sla.elapsedMinutes)} waiting`}
                      </span>
                    </span>
                    <span className="type-admin text-fg">{row.customerName}</span>
                    <span className="type-small text-fg-muted">
                      {row.phone} · {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'} ·{' '}
                      {formatPrice(deserialize(row.total))}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <OrderStatusBadge status={row.status} />
                      <Badge tone={row.prepaid ? 'success' : 'outline'}>{row.paymentLabel}</Badge>
                      {row.riskScore >= 50 ? <Badge tone="danger">High risk</Badge> : null}
                      {row.riskFlags.slice(0, 2).map((flag) => (
                        <Badge key={flag} tone="outline">
                          {flag.replaceAll('_', ' ')}
                        </Badge>
                      ))}
                      {row.callbackDue ? <Badge tone="warning">Call back due</Badge> : null}
                      {row.needsManagerReview ? <Badge tone="danger">Needs a manager</Badge> : null}
                    </span>
                    <span className="type-small text-fg-muted">
                      {row.assignee
                        ? `${row.mine ? 'You' : row.assignee.name}${row.lockedByOther ? ' (locked)' : ''}`
                        : 'Unassigned'}
                      {row.attempts > 0
                        ? ` · ${row.attempts} ${row.attempts === 1 ? 'attempt' : 'attempts'}`
                        : ''}
                      {row.nextAttemptAt
                        ? ` · retry ${timeOnly.format(new Date(row.nextAttemptAt))}`
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="min-w-0">
            {workspace ? (
              <VerificationWorkspace
                key={workspace.id}
                workspace={workspace}
                areas={areas}
                assignable={assignable}
                viewer={{
                  staffId: staff.id,
                  manager,
                  canEdit: hasPermission(staff, 'orders.verify'),
                }}
                navigation={{
                  previousHref: navigation.previousId ? hrefFor(navigation.previousId) : null,
                  nextHref: navigation.nextId ? hrefFor(navigation.nextId) : null,
                }}
              />
            ) : (
              <EmptyState
                title="That order is not here"
                description="It may have been confirmed or cancelled by someone else."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
