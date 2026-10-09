import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { AuditFilterBar } from '@/components/admin/audit/audit-filter-bar';
import { AuditLogTable } from '@/components/admin/audit/audit-log-table';
import { Skeleton } from '@/components/ui/skeleton';
import { requireStaffWith } from '@/lib/staff';
import { getAuditLogsForAdmin } from '@/modules/audit/queries';

export const metadata: Metadata = { title: 'Audit Trail | Settings' };

interface AuditPageProps {
  searchParams: Promise<{
    entity?: string;
    action?: string;
    page?: string;
  }>;
}

export default async function AuditSettingsPage({ searchParams }: AuditPageProps) {
  await requireStaffWith('audit.read');

  const { entity, action, page } = await searchParams;
  const pageNum = page ? parseInt(page, 10) : 1;

  const result = await getAuditLogsForAdmin({
    entityType: entity,
    action,
    page: Number.isNaN(pageNum) ? 1 : pageNum,
    limit: 25,
  });

  const queryParams = new URLSearchParams();
  if (entity) queryParams.set('entity', entity);
  if (action) queryParams.set('action', action);
  const baseUrl = `/admin/settings/audit${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Trail"
        description="Immutable record of administrative operations, catalog edits, settings revisions, and staff role adjustments."
      />

      <Suspense fallback={<Skeleton className="h-16 w-full" />}>
        <AuditFilterBar
          entityTypes={result.availableEntityTypes}
          actions={result.availableActions}
          selectedEntityType={entity}
          selectedAction={action}
        />
      </Suspense>

      <AuditLogTable
        logs={result.items}
        totalCount={result.totalCount}
        page={result.page}
        totalPages={result.totalPages}
        baseUrl={baseUrl}
      />
    </div>
  );
}
