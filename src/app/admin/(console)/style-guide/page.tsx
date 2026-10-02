import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { StyleGuide } from '@/components/style-guide/style-guide';
import { requireStaff } from '@/lib/staff';

export const metadata: Metadata = {
  title: 'Style guide',
  robots: { index: false, follow: false },
};

/** Staff-only reference of every component and state, also used for visual snapshots. */
export default async function StyleGuidePage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Style guide"
        description="Every component and state in the design system. Review here before building new screens."
      />
      <StyleGuide />
    </>
  );
}
