import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { CreateDiscountDialog } from '@/components/admin/promotions/create-discount-dialog';
import { DiscountsTable, type DiscountRow } from '@/components/admin/promotions/discounts-table';
import { assertPermission, hasPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { getDiscountsForAdmin } from '@/modules/promotions/queries';

export const metadata: Metadata = {
  title: 'Promotions & Pricing — Auren Console',
  description: 'Manage discount codes, automatic rules, and promotional pricing campaigns.',
};

interface PromotionsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: 'all' | 'active' | 'inactive';
  }>;
}

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'promotions.manage');

  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const statusParam = resolvedParams.status;
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : undefined;

  const { items, total } = await getDiscountsForAdmin({
    search: q,
    status,
    pageSize: 50,
  });

  const canManage = hasPermission(staff, 'promotions.manage');

  const serializedRows: DiscountRow[] = items.map((item) => ({
    id: item.id,
    code: item.code,
    title: item.title,
    type: item.type,
    value: item.value,
    minSubtotalMinor: item.minSubtotalMinor ? item.minSubtotalMinor.toString() : null,
    maxDiscountMinor: item.maxDiscountMinor ? item.maxDiscountMinor.toString() : null,
    customerEligibility: item.customerEligibility,
    usageCount: item.usageCount,
    usageLimit: item.usageLimit,
    usageLimitPerCustomer: item.usageLimitPerCustomer,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt ? item.endsAt.toISOString() : null,
    isActive: item.isActive,
  }));

  const activeCount = items.filter((i) => i.isActive).length;
  const totalRedemptions = items.reduce((sum, i) => sum + i.usageCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Promotions & Pricing"
          description="Campaign codes, percentage discounts, threshold rules, and automatic promotions."
        />
        {canManage ? <CreateDiscountDialog /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded bg-surface border border-line p-4">
          <p className="type-eyebrow text-fg-muted">Active Promotions</p>
          <p className="type-h2 text-fg">{activeCount}</p>
        </div>
        <div className="rounded bg-surface border border-line p-4">
          <p className="type-eyebrow text-fg-muted">Total Campaigns</p>
          <p className="type-h2 text-fg">{total}</p>
        </div>
        <div className="rounded bg-surface border border-line p-4">
          <p className="type-eyebrow text-fg-muted">Total Redemptions</p>
          <p className="type-h2 text-fg">{totalRedemptions}</p>
        </div>
      </div>

      <DiscountsTable discounts={serializedRows} total={total} canManage={canManage} />
    </div>
  );
}
