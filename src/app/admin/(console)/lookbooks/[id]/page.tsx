import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';
import { getAdminLookbookDetailQuery } from '@/modules/lookbook/queries';
import { LookbookEditor } from '@/components/admin/lookbook/lookbook-editor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Lookbook Studio | Auren Admin',
};

export default async function AdminLookbookDetailPage({ params }: PageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  const { id } = await params;
  const lookbook = await getAdminLookbookDetailQuery(id);

  if (!lookbook) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/lookbooks"
          className="inline-flex items-center gap-1.5 type-caption font-mono text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={13} />
          <span>Back to Lookbooks</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="type-title-lg font-serif text-fg">{lookbook.title}</h1>
          <p className="type-caption text-fg-muted">
            Season: {lookbook.season} • {lookbook.slides.length} Frames
          </p>
        </div>
      </div>

      <LookbookEditor lookbook={lookbook} />
    </div>
  );
}
