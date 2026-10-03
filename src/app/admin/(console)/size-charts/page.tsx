import Link from 'next/link';
import { SizeChartTable } from '@/components/admin/catalog/size-charts/size-chart-table';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listSizeChartsForAdmin } from '@/modules/catalog/queries';

export const metadata = { title: 'Size charts' };

export default async function SizeChartsPage() {
  const staff = await requireStaffWith('catalog.read');
  const canWrite = hasPermission(staff, 'catalog.write');
  const charts = await listSizeChartsForAdmin();

  return (
    <>
      <PageHeader
        title="Size charts"
        description="Measurement tables shoppers use to pick a size. Assign a chart to a product from the product screen."
        actions={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/admin/size-charts/new">New size chart</Link>
            </Button>
          ) : undefined
        }
      />
      <SizeChartTable rows={charts} canWrite={canWrite} />
    </>
  );
}
