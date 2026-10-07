import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getHeroCarouselForAdmin } from '@/modules/settings/queries';
import { CarouselSettingsManager } from './carousel-settings-manager';

export const metadata: Metadata = { title: 'Hero Carousel & Banners' };

export default async function CarouselSettingsPage() {
  await requireStaffWith('settings.manage');
  const settings = await getHeroCarouselForAdmin();

  return (
    <>
      <PageHeader
        title="Hero carousel & banners"
        description="Customize homepage campaign slides, photography, editorial messaging, and call-to-actions. Changes update the storefront immediately."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Hero carousel & banners' },
        ]}
      />
      <CarouselSettingsManager initialSettings={settings} />
    </>
  );
}
