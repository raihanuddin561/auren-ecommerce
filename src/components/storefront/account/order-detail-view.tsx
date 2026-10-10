'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Printer,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { money } from '@/lib/money';
import { addToCart } from '@/modules/cart/actions';
import { setCartView, openCartDrawer } from '@/components/storefront/cart/cart-store';
import { toast } from 'sonner';

export interface OrderAddressData {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  area?: string;
  district?: string;
  division?: string;
  postalCode?: string;
}

type OrderMilestoneTimestamps = {
  [K in 'confirmedAt' | 'cancelledAt']?: Date | string | null;
};

export type CustomerOrderDetailData = OrderMilestoneTimestamps & {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  channel: string;
  currency: string;
  email?: string | null;
  phone?: string | null;
  subtotalMinor: bigint;
  discountMinor: bigint;
  shippingChargedMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  paidMinor: bigint;
  refundedMinor: bigint;
  shippingAddress: OrderAddressData | null;
  shippingMethod: Record<string, unknown> | null;
  discountCodes: string[];
  customerNote: string | null;
  placedAt: Date | string;
  shippedAt: Date | string | null;
  deliveredAt: Date | string | null;
  cancelReason: string | null;
  items: Array<{
    id: string;
    variantId: string;
    productId: string;
    titleSnapshot: string;
    variantTitleSnapshot: string | null;
    skuSnapshot: string;
    optionsSnapshot: Record<string, unknown> | null;
    imageSnapshot: string | null;
    unitPriceMinor: bigint;
    compareAtMinor: bigint | null;
    quantity: number;
    discountMinor: bigint;
    totalMinor: bigint;
    variant?: {
      id: string;
      product?: {
        slug: string;
        media?: Array<{ url: string; alt?: string | null }>;
      } | null;
    } | null;
  }>;
  shipments: Array<{
    id: string;
    courier: string;
    courierName: string | null;
    trackingNumber: string | null;
    consignmentId: string | null;
    status: string;
    deliveredAt: Date | string | null;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    amountMinor: bigint;
    currency: string;
    createdAt: Date | string;
  }>;
};

interface OrderDetailViewProps {
  order: CustomerOrderDetailData;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  placed: { label: 'Commission Received', className: 'bg-sunken text-fg-muted' },
  under_verification: {
    label: 'Under Atelier Verification',
    className: 'bg-gold/15 text-accent-text',
  },
  on_hold: { label: 'Commission On Hold', className: 'bg-warning/15 text-warning-text' },
  confirmed: { label: 'Confirmed & Slotted', className: 'bg-gold/15 text-accent-text' },
  processing: { label: 'In Atelier Tailoring', className: 'bg-sunken text-fg font-medium' },
  shipped: { label: 'Dispatched with Courier', className: 'bg-gold/15 text-accent-text' },
  delivered: { label: 'Delivered', className: 'bg-success/15 text-success-text' },
  delivery_failed: { label: 'Delivery Attempt Failed', className: 'bg-danger/15 text-danger-text' },
  returned_to_origin: { label: 'Returned to Atelier', className: 'bg-sunken text-fg-muted' },
  completed: { label: 'Completed', className: 'bg-success/15 text-success-text' },
  return_requested: {
    label: 'Exchange / Return Requested',
    className: 'bg-gold/15 text-accent-text',
  },
  returned: { label: 'Returned', className: 'bg-sunken text-fg-muted' },
  refunded: { label: 'Refunded', className: 'bg-sunken text-fg-muted' },
  exchanged: { label: 'Exchanged', className: 'bg-gold/15 text-accent-text' },
  cancelled: { label: 'Cancelled', className: 'bg-danger/15 text-danger-text' },
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderDetailView({ order }: OrderDetailViewProps) {
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const [reorderingAll, setReorderingAll] = useState(false);

  const badge = STATUS_BADGES[order.status] ?? {
    label: order.status.replace(/_/g, ' '),
    className: 'bg-sunken text-fg-muted',
  };

  const isDelivered = order.status === 'delivered' || order.status === 'completed';
  const isCancelled = order.status === 'cancelled';
  const activeShipment = order.shipments[0];

  // Address normalization
  const addr = order.shippingAddress ?? {};

  // Timeline Step Calculations
  const timelineSteps = [
    {
      title: 'Commission Placed',
      description: 'Order registered in atelier database',
      date: order.placedAt,
      completed: true,
      current: order.status === 'placed',
    },
    {
      title: 'Tailoring & Prep',
      description: 'Pattern verify & garment quality check',
      date: order.confirmedAt,
      completed:
        Boolean(order.confirmedAt) ||
        ['processing', 'shipped', 'delivered', 'completed'].includes(order.status),
      current: ['under_verification', 'confirmed', 'processing'].includes(order.status),
    },
    {
      title: 'Dispatched',
      description: activeShipment
        ? `Handed to ${activeShipment.courierName || activeShipment.courier}`
        : 'Courier custody handoff',
      date: order.shippedAt,
      completed: Boolean(order.shippedAt) || ['delivered', 'completed'].includes(order.status),
      current: order.status === 'shipped',
    },
    {
      title: 'Delivered',
      description: 'Doorstep arrival and client handoff',
      date: order.deliveredAt,
      completed: Boolean(order.deliveredAt) || isDelivered,
      current: isDelivered,
    },
  ];

  async function handleReorderItem(variantId: string, title: string) {
    setAddingVariantId(variantId);
    try {
      const res = await addToCart({ variantId, quantity: 1 });
      if (!res.ok) {
        toast.error(res.error.message || `Unable to add ${title} to bag.`);
        return;
      }
      setCartView(res.data.view);
      openCartDrawer();
      toast.success(`${title} added to your bag.`);
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setAddingVariantId(null);
    }
  }

  async function handleReorderAll() {
    setReorderingAll(true);
    let addedCount = 0;
    try {
      for (const item of order.items) {
        if (item.variantId) {
          const res = await addToCart({ variantId: item.variantId, quantity: item.quantity });
          if (res.ok) {
            setCartView(res.data.view);
            addedCount++;
          }
        }
      }
      if (addedCount > 0) {
        openCartDrawer();
        toast.success(`Added ${addedCount} pieces to your shopping bag.`);
      } else {
        toast.error('Items could not be reordered at this time.');
      }
    } catch {
      toast.error('Failed to complete reorder.');
    } finally {
      setReorderingAll(false);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  const conciergeWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+8801700000000';
  const whatsappUrl = `https://wa.me/${conciergeWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hello Auren Atelier, I am inquiring regarding my Commission ${order.orderNumber}.`,
  )}`;

  return (
    <div className="space-y-8">
      {/* Back Link & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 print:hidden">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 type-caption font-mono text-fg-muted uppercase transition-colors hover:text-fg"
        >
          <ArrowLeft size={13} />
          <span>Back to All Commissions</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrintReceipt} className="gap-1.5">
            <Printer size={13} />
            <span>Print Receipt</span>
          </Button>

          <Button size="sm" onClick={handleReorderAll} disabled={reorderingAll} className="gap-1.5">
            <ShoppingBag size={13} />
            <span>{reorderingAll ? 'Adding...' : 'Reorder Commission'}</span>
          </Button>
        </div>
      </div>

      {/* Hero Commission Overview Header */}
      <div className="rounded-xs border border-line bg-raised p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
                COMMISSION RECEIPT
              </span>
              <span className="font-mono text-fg-muted">•</span>
              <span className="type-caption font-mono text-fg-muted">
                {formatDate(order.placedAt)}
              </span>
            </div>
            <h1 className="mt-1 font-serif text-3xl font-light text-fg md:text-4xl">
              {order.orderNumber}
            </h1>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-3 py-1 type-caption font-mono tracking-wider uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="type-caption font-mono text-fg-muted uppercase">
              Payment: {order.paymentStatus}
            </span>
          </div>
        </div>

        {/* Courier Dispatch Banner if Shipped */}
        {activeShipment && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xs border border-line bg-page p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xs bg-raised text-accent-text">
                <Truck size={20} />
              </div>
              <div>
                <p className="type-body-sm font-medium text-fg">
                  Dispatched via{' '}
                  {activeShipment.courierName || activeShipment.courier.toUpperCase()}
                </p>
                {activeShipment.trackingNumber && (
                  <p className="type-caption font-mono text-fg-muted">
                    Consignment No:{' '}
                    <span className="font-medium text-fg">{activeShipment.trackingNumber}</span>
                  </p>
                )}
              </div>
            </div>

            <Link
              href={`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-raised px-3 py-1.5 type-caption font-mono text-fg transition-colors hover:border-fg"
            >
              <span>Live Courier Tracking</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Visual Delivery Stepper Timeline */}
      {!isCancelled && (
        <div className="rounded-xs border border-line bg-page p-6 md:p-8">
          <h2 className="type-title-md font-serif text-fg">Dispatch &amp; Craft Timeline</h2>
          <p className="mt-0.5 type-caption text-fg-muted">
            Real-time milestone tracking for your garments through the Banani atelier and courier
            network.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {timelineSteps.map((step, idx) => {
              return (
                <div key={idx} className="relative flex flex-col">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        step.completed
                          ? 'border-accent-text bg-accent-text text-ivory'
                          : 'border-line bg-raised text-fg-muted'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <span className="type-caption font-mono">{idx + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`type-body-sm font-medium ${
                          step.completed ? 'text-fg' : 'text-fg-muted'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="type-caption font-mono text-fg-muted">
                        {step.date ? formatDate(step.date) : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 pl-11 type-caption text-fg-muted">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Doorstep Size Exchange / Return Notice if Delivered */}
      {isDelivered && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xs border border-line bg-raised/40 p-6">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-page text-accent-text">
              <RotateCcw size={18} />
            </div>
            <div>
              <h4 className="type-title-sm font-serif text-fg">Doorstep Size Exchange Privilege</h4>
              <p className="type-caption text-fg-muted">
                Need an adjusted size? Our riders arrange direct doorstep exchanges in Dhaka within
                7 days of delivery.
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" asChild>
            <Link href={`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}>
              Request Exchange / Return
            </Link>
          </Button>
        </div>
      )}

      {/* Garments Breakdown Table */}
      <div className="overflow-hidden rounded-xs border border-line bg-page">
        <div className="border-b border-line bg-raised/30 p-6">
          <h2 className="type-title-md font-serif text-fg">
            Commissioned Garments ({order.items.length})
          </h2>
          <p className="type-caption text-fg-muted">
            Noble materials, sizing discipline, and bespoke finishing details.
          </p>
        </div>

        <div className="divide-y divide-line">
          {order.items.map((item) => {
            const mediaUrl = item.imageSnapshot || item.variant?.product?.media?.[0]?.url;
            const productHref = item.variant?.product?.slug
              ? `/products/${item.variant.product.slug}`
              : null;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xs border border-line bg-raised">
                    {mediaUrl ? (
                      <Image
                        src={mediaUrl}
                        alt={item.titleSnapshot}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center type-caption font-serif text-fg-muted">
                        AUREN
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    {productHref ? (
                      <Link
                        href={productHref}
                        className="type-title-sm font-serif text-fg transition-colors hover:text-accent-text"
                      >
                        {item.titleSnapshot}
                      </Link>
                    ) : (
                      <h4 className="type-title-sm font-serif text-fg">{item.titleSnapshot}</h4>
                    )}

                    {item.variantTitleSnapshot && (
                      <p className="mt-0.5 type-caption font-mono text-fg-muted">
                        {item.variantTitleSnapshot}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-3 type-caption font-mono text-fg-muted">
                      <span>SKU: {item.skuSnapshot}</span>
                      <span>•</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="type-caption font-mono text-fg-muted">
                      {item.quantity} × <Price price={money(item.unitPriceMinor, order.currency)} />
                    </p>
                    <Price
                      price={money(item.totalMinor, order.currency)}
                      className="type-body-sm font-medium text-fg"
                    />
                  </div>

                  {item.variantId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReorderItem(item.variantId, item.titleSnapshot)}
                      disabled={addingVariantId === item.variantId}
                      className="gap-1.5 text-xs text-accent-text hover:bg-raised"
                    >
                      <ShoppingBag size={12} />
                      <span>{addingVariantId === item.variantId ? 'Adding...' : 'Reorder'}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Destination & Financial Summary */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Verified Residence & Concierge */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xs border border-line bg-page p-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="type-title-sm font-serif text-fg">Delivery Residence</h3>
              <MapPin size={15} className="text-accent-text" />
            </div>

            <div className="mt-4 space-y-1.5 type-body-sm text-fg-muted">
              <p className="font-medium text-fg">{addr.fullName || 'Patron'}</p>
              <p className="type-caption font-mono">{addr.phone || order.phone || ''}</p>
              <p className="mt-2">{addr.line1}</p>
              {addr.line2 && <p>{addr.line2}</p>}
              <p>
                {[addr.area, addr.district, addr.division, addr.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>

          {/* Payment & Security Method */}
          <div className="rounded-xs border border-line bg-page p-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="type-title-sm font-serif text-fg">Payment Method</h3>
              <CreditCard size={15} className="text-accent-text" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="type-body-sm font-medium text-fg">
                  {order.payments[0]?.provider === 'cod'
                    ? 'Cash on Delivery (COD)'
                    : order.payments[0]?.provider
                      ? order.payments[0].provider.toUpperCase()
                      : 'Atelier Settlement'}
                </p>
                <p className="type-caption font-mono text-fg-muted">
                  Status:{' '}
                  <span className="font-medium text-accent-text uppercase">
                    {order.paymentStatus}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 type-caption font-mono text-fg-muted">
                <ShieldCheck size={14} className="text-accent-text" />
                <span>Verified Transaction</span>
              </div>
            </div>
          </div>

          {/* Concierge Desk Support */}
          <div className="rounded-xs border border-line bg-raised/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="type-title-sm font-serif text-fg">Atelier Concierge Desk</h4>
                <p className="mt-0.5 type-caption text-fg-muted">
                  Direct personal styling or alteration queries for this commission.
                </p>
              </div>

              <Link
                href={whatsappUrl}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-page px-3 py-1.5 type-caption font-mono text-accent-text transition-colors hover:border-accent-text"
              >
                <MessageCircle size={13} />
                <span>WhatsApp Desk</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Financial Investment Breakdown */}
        <div className="lg:col-span-5">
          <div className="space-y-4 rounded-xs border border-line bg-page p-6">
            <h3 className="type-title-md border-b border-line pb-3 font-serif text-fg">
              Investment Breakdown
            </h3>

            <div className="space-y-2.5 type-body-sm text-fg-muted">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <Price
                  price={money(order.subtotalMinor, order.currency)}
                  className="font-mono text-fg"
                />
              </div>

              {order.discountMinor > 0n && (
                <div className="flex justify-between text-accent-text">
                  <span>Privilege Savings</span>
                  <span className="font-mono">
                    -<Price price={money(order.discountMinor, order.currency)} />
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery &amp; Transit</span>
                <Price
                  price={money(order.shippingChargedMinor, order.currency)}
                  className="font-mono text-fg"
                />
              </div>

              {order.taxMinor > 0n && (
                <div className="flex justify-between">
                  <span>Included Tax (VAT)</span>
                  <Price
                    price={money(order.taxMinor, order.currency)}
                    className="font-mono text-fg"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="type-title-md font-serif text-fg">Total Investment</span>
              <Price
                price={money(order.totalMinor, order.currency)}
                className="font-mono text-lg font-semibold text-fg"
              />
            </div>

            {order.customerNote && (
              <div className="mt-4 rounded-xs border border-line/60 bg-raised/30 p-3">
                <span className="block type-caption font-mono text-fg-muted uppercase">
                  Client Tailoring Note:
                </span>
                <p className="mt-1 type-caption font-serif text-fg italic">
                  &ldquo;{order.customerNote}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
