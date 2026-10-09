import type { Metadata } from 'next';
import { ManualOrderForm } from '@/components/admin/orders/manual-order-form';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getVerificationSettings } from '@/modules/settings/queries';
import { getDivisionsAndDistricts } from '@/modules/shipping/queries';

export const metadata: Metadata = { title: 'New order' };

export default async function NewOrderPage() {
  await requireStaffWith('orders.update');
  const [areas, settings] = await Promise.all([
    getDivisionsAndDistricts(),
    getVerificationSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Enter an order"
        description="For orders that arrive by phone, Facebook, Instagram, WhatsApp or in store. It joins the verification queue like every other order."
        breadcrumb={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Enter an order' }]}
      />
      <ManualOrderForm areas={areas} selfVerify={settings.manualOrdersSelfVerify} />
    </>
  );
}
