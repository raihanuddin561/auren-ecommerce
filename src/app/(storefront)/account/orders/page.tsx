import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomerOrders } from '@/modules/customer/queries';
import { OrdersList } from '@/components/storefront/account/orders-list';

export const metadata: Metadata = {
  title: 'Order History | AUREN',
  description: 'View your previous bespoke commissions and track current dispatches.',
};

export default async function AccountOrdersPage() {
  const user = await requireUser();
  const orders = await getCustomerOrders(user.id);

  return <OrdersList orders={orders} />;
}
