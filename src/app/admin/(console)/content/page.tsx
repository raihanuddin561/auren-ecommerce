import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getPagesForAdmin } from '@/modules/content/queries';
import { PagesTable } from '@/components/admin/content/pages-table';
import { Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Landing Pages & Experience Builder | Admin Console',
};

export default async function AdminContentPage() {
  await requireStaffWith('content.manage');
  const { items, totalCount } = await getPagesForAdmin({ limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Landing Pages & Experience Builder"
        description="Design and manage luxury editorial pages, seasonal capsule drops, and section blocks with draft preview."
        actions={
          <Button asChild size="sm" className="gap-1.5 bg-ink text-xs text-ivory hover:bg-ink/90">
            <Link href="/admin/content/new">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              New Landing Page
            </Link>
          </Button>
        }
      />

      <PagesTable pages={items} totalCount={totalCount} />
    </div>
  );
}
