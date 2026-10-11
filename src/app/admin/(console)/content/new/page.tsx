import type { Metadata } from 'next';
import { requireStaffWith } from '@/lib/staff';
import { NewLandingPageStudio } from '@/components/admin/content/new-landing-page-studio';

export const metadata: Metadata = {
  title: 'New Landing Page Studio | Admin Console',
};

export default async function AdminNewLandingPage() {
  await requireStaffWith('content.manage');

  return <NewLandingPageStudio />;
}
