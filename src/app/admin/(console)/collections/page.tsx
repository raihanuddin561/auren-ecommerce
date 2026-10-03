import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { CollectionsTable } from '@/components/admin/catalog/collections/collections-table';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listCollectionsForAdmin } from '@/modules/catalog/queries';

export const metadata: Metadata = {
  title: 'Collections',
  robots: { index: false, follow: false },
};

export default async function CollectionsPage() {
  const staff = await requireStaffWith('catalog.read');
  const canWrite = hasPermission(staff, 'catalog.write');
  const collections = await listCollectionsForAdmin();

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group products for the shop. Manual collections are arranged by hand; automatic ones follow rules."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/collections/new">New collection</Link>
            </Button>
          ) : null
        }
      />
      <CollectionsTable
        canWrite={canWrite}
        rows={collections.map((collection) => ({
          id: collection.id,
          title: collection.title,
          slug: collection.slug,
          type: collection.type,
          state: collection.state,
          publishedAt: collection.publishedAt ? collection.publishedAt.toISOString() : null,
          isFeatured: collection.isFeatured,
          productCount: collection.productCount,
        }))}
      />
    </>
  );
}
