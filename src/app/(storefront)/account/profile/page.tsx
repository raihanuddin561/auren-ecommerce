import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getCustomerProfile } from '@/modules/customer/queries';
import { ProfileForm } from '@/components/storefront/account/profile-form';

export const metadata: Metadata = {
  title: 'Client Profile & Sizing | AUREN',
  description: 'Manage your personal details and concierge preferences.',
};

export default async function AccountProfilePage() {
  const user = await requireUser();
  const profile = await getCustomerProfile(user.id);

  if (!profile) {
    notFound();
  }

  return <ProfileForm user={profile} />;
}
