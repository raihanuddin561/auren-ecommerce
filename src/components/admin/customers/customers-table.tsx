'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { CustomerStatusBadge } from './customer-status-badge';
import { CustomerBlockDialog } from './customer-block-dialog';

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  banned: boolean;
  createdAt: string;
  ordersCount: number;
  addressesCount: number;
  ltvFormatted: string;
  lastOrderAt: string | null;
}

interface CustomersTableProps {
  customers: CustomerRow[];
  total: number;
  currentSearch: string;
  currentStatus: string;
  canWrite: boolean;
}

const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Asia/Dhaka',
});

export function CustomersTable({
  customers,
  total,
  currentSearch,
  currentStatus,
  canWrite,
}: CustomersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateQuery(updates: { q?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.q !== undefined) {
      if (updates.q.trim()) {
        params.set('q', updates.q.trim());
      } else {
        params.delete('q');
      }
    }
    if (updates.status !== undefined) {
      if (updates.status && updates.status !== 'all') {
        params.set('status', updates.status);
      } else {
        params.delete('status');
      }
    }
    params.delete('page');
    startTransition(() => {
      router.push(`/admin/customers?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get('q') as string) ?? '';
    updateQuery({ q });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <Input
            name="q"
            defaultValue={currentSearch}
            placeholder="Search by name, email, or phone..."
            className="pr-10"
          />
          <button
            type="submit"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted transition-auren-fast hover:text-fg"
            aria-label="Search clients"
          >
            <Icon icon={Search} size={16} />
          </button>
        </form>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 border border-line bg-raised p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'blocked', label: 'Blocked' },
          ].map((tab) => {
            const active = (currentStatus || 'all') === tab.id;
            return (
              <Button
                key={tab.id}
                variant={active ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => updateQuery({ status: tab.id })}
                disabled={pending}
                className="h-8 px-3 type-eyebrow"
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between type-small text-fg-muted">
        <p>
          Showing {customers.length} of {total} registered clients
        </p>
      </div>

      {/* Table / Empty State */}
      {customers.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Users} size={32} />}
          title="No clients found"
          description={
            currentSearch || currentStatus !== 'all'
              ? 'No registered customers match your current search or status filter.'
              : 'There are no registered customer accounts in the database yet.'
          }
          action={
            currentSearch || currentStatus !== 'all' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    router.push('/admin/customers');
                  });
                }}
              >
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto border border-line bg-raised">
          <table className="w-full border-collapse text-left type-admin">
            <thead>
              <tr className="bg-subtle">
                <th className={head}>Client</th>
                <th className={head}>Contact</th>
                <th className={head}>Spend (LTV)</th>
                <th className={head}>Orders</th>
                <th className={head}>Status</th>
                <th className={head}>Joined</th>
                <th className={`${head} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className="transition-auren-fast hover:bg-fg/2">
                  <td className={cell}>
                    <div className="flex flex-col">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className="type-small text-fg-muted">{c.email}</span>
                    </div>
                  </td>
                  <td className={cell}>
                    <span className="text-fg-muted tabular-nums">{c.phone ?? '—'}</span>
                  </td>
                  <td className={cell}>
                    <span className="font-medium text-fg tabular-nums">{c.ltvFormatted}</span>
                  </td>
                  <td className={cell}>
                    <span className="text-fg-muted tabular-nums">{c.ordersCount}</span>
                  </td>
                  <td className={cell}>
                    <CustomerStatusBadge banned={c.banned} />
                  </td>
                  <td className={cell}>
                    <span className="type-small text-fg-muted">
                      {dateFormat.format(new Date(c.createdAt))}
                    </span>
                  </td>
                  <td className={`${cell} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <CustomerBlockDialog
                        customerId={c.id}
                        customerName={c.name}
                        isBlocked={c.banned}
                        canWrite={canWrite}
                      />
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                        <Link href={`/admin/customers/${c.id}`} aria-label={`View ${c.name}`}>
                          <Icon icon={ChevronRight} size={16} />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
