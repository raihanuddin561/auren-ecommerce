import type { Metadata } from 'next';
import { CampaignsTable } from '@/components/admin/finance/campaigns-table';
import { getMarketingCampaignsForAdmin } from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Marketing Campaigns | Finance' };

export default async function CampaignsPage() {
  const campaigns = await getMarketingCampaignsForAdmin();

  return <CampaignsTable campaigns={campaigns} />;
}
