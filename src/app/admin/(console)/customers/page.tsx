import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { CustomersTable, type CustomerRow } from '@/components/admin/customers/customers-table';
import { assertPermission, hasPermission } from '@/lib/permissions';
import { format, money } from '@/lib/money';
import { requireStaff } from '@/lib/staff';
import { getCustomersForAdmin } from '@/modules/customer/queries';

export const metadata: Metadata = {
  title: 'Customers — Auren Console',
  description: 'Manage registered clients, review lifetime metrics, and regulate account access.',
};

interface CustomersPageProps {
  searchParams: Promise<{
    q?: string;
    status?: 'all' | 'active' | 'blocked';
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'customers.read');

  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const statusParam = resolvedParams.status;
  const status = statusParam === 'active' || statusParam === 'blocked' ? statusParam : undefined;

  const { items, total } = await getCustomersForAdmin({
    search: q,
    status,
    take: 50,
  });

  const canWrite = hasPermission(staff, 'customers.write');

  const serializedRows: CustomerRow[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    phone: item.phone,
    banned: item.banned,
    createdAt: item.createdAt.toISOString(),
    ordersCount: item.ordersCount,
    addressesCount: item.addressesCount,
    ltvFormatted: format(money(item.ltvMinor, item.currency), { trimZeroFraction: true }),
    lastOrderAt: item.lastOrderAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Directory of registered clientele, lifetime value analytics, and account restriction controls."
      />

      <CustomersTable
        customers={serializedRows}
        total={total}
        currentSearch={q}
        currentStatus={statusParam || 'all'}
        canWrite={canWrite}
      />
    </div>
  );
}
