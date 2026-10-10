import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { getCustomerOrderDetail } from '@/modules/customer/queries';
import { OrderDetailView } from '@/components/storefront/account/order-detail-view';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Commission ${id} | AUREN`,
    description: `Private commission overview, garment specifications, and dispatch timeline.`,
  };
}

async function OrderDetailContent({ params }: OrderDetailPageProps) {
  await connection();
  const user = await requireUser();
  const { id } = await params;

  const order = await getCustomerOrderDetail(user.id, id);

  if (!order) {
    notFound();
  }

  return (
    <OrderDetailView order={order as unknown as Parameters<typeof OrderDetailView>[0]['order']} />
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-6 w-48 rounded-xs bg-skeleton" />
      <div className="h-44 rounded-xs border border-line bg-raised p-6" />
      <div className="h-64 rounded-xs border border-line bg-page p-6" />
      <div className="h-72 rounded-xs border border-line bg-page p-6" />
    </div>
  );
}

export default function OrderDetailPage(props: OrderDetailPageProps) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailContent {...props} />
    </Suspense>
  );
}
