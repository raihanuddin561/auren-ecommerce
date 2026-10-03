import { notFound } from 'next/navigation';
import { z } from 'zod';
import { SizeChartDeleteSection } from '@/components/admin/catalog/size-charts/size-chart-delete-section';
import { SizeChartForm } from '@/components/admin/catalog/size-charts/size-chart-form';
import { PageHeader } from '@/components/admin/page-header';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getSizeChartForAdmin } from '@/modules/catalog/queries';

export const metadata = { title: 'Edit size chart' };

export default async function EditSizeChartPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffWith('catalog.read');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const chart = await getSizeChartForAdmin(id);
  if (!chart) notFound();
  const canWrite = hasPermission(staff, 'catalog.write');

  return (
    <>
      <PageHeader
        title={chart.name}
        description={`Used by ${chart.productCount} product${chart.productCount === 1 ? '' : 's'}.`}
        breadcrumb={[{ label: 'Size charts', href: '/admin/size-charts' }, { label: chart.name }]}
      />
      <div className="flex flex-col gap-6">
        <SizeChartForm chart={chart} canWrite={canWrite} />
        {canWrite ? (
          <SizeChartDeleteSection
            id={chart.id}
            name={chart.name}
            productCount={chart.productCount}
          />
        ) : null}
      </div>
    </>
  );
}
