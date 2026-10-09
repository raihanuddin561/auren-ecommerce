import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getPageDetailForAdmin } from '@/modules/content/queries';
import { PageEditor } from '@/components/admin/content/page-editor';

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Edit Page & Section Blocks | Admin Console',
};

export default async function AdminEditContentPage({ params }: EditPageProps) {
  await requireStaffWith('content.manage');
  const { id } = await params;
  const page = await getPageDetailForAdmin(id);

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Page Builder & Blocks"
        description={`Customizing layout, blocks, and scheduling for "${page.title}".`}
      />

      <PageEditor initialPage={page} />
    </div>
  );
}
