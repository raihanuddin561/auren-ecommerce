import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomerAddresses } from '@/modules/customer/queries';
import { getDivisionsAndDistricts } from '@/modules/shipping/queries';
import { AddressBook } from '@/components/storefront/account/address-book';

export const metadata: Metadata = {
  title: 'Address Book | AUREN',
  description: 'Manage your verified delivery addresses and residences across Bangladesh.',
};

export default async function AccountAddressesPage() {
  const user = await requireUser();
  const [addresses, { divisions, districts }] = await Promise.all([
    getCustomerAddresses(user.id),
    getDivisionsAndDistricts(),
  ]);

  return <AddressBook addresses={addresses} divisions={divisions} districts={districts} />;
}
