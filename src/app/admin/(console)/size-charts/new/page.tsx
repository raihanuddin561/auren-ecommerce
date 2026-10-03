import { SizeChartForm } from '@/components/admin/catalog/size-charts/size-chart-form';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';

export const metadata = { title: 'New size chart' };

export default async function NewSizeChartPage() {
  await requireStaffWith('catalog.write');
  return (
    <>
      <PageHeader
        title="New size chart"
        breadcrumb={[
          { label: 'Size charts', href: '/admin/size-charts' },
          { label: 'New size chart' },
        ]}
      />
      <SizeChartForm canWrite />
    </>
  );
}
