import type { Metadata } from 'next';
import { requireStaff } from '@/lib/staff';
import { CampaignsTable } from '@/components/admin/finance/campaigns-table';
import { getMarketingCampaignsForAdmin } from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Marketing Campaigns | Finance' };

export default async function CampaignsPage() {
  await requireStaff();
  const campaigns = await getMarketingCampaignsForAdmin();

  return <CampaignsTable campaigns={campaigns} />;
}
