'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Package, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Price } from '@/components/ui/price';
import { money } from '@/lib/money';

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalMinor: bigint;
  currency: string;
  createdAt: Date | string;
  items: Array<{
    id: string;
    quantity: number;
    titleSnapshot: string;
    variantTitleSnapshot?: string | null;
    imageSnapshot?: string | null;
    unitPriceMinor: bigint;
    totalMinor: bigint;
    variant?: {
      product?: {
        media?: Array<{
          url: string;
          alt?: string | null;
        }>;
      } | null;
    } | null;
  }>;
}

interface OrdersListProps {
  orders: CustomerOrderSummary[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-sunken text-fg-muted' },
  verification: { label: 'Under Verification', className: 'bg-gold/15 text-accent-text' },
  confirmed: { label: 'Confirmed', className: 'bg-gold/15 text-accent-text' },
  processing: { label: 'In Atelier Prep', className: 'bg-sunken text-fg font-medium' },
  dispatched: { label: 'Dispatched', className: 'bg-gold/15 text-accent-text' },
  delivered: { label: 'Delivered', className: 'bg-success/15 text-success-text' },
  cancelled: { label: 'Cancelled', className: 'bg-danger/15 text-danger-text' },
  returned: { label: 'Returned', className: 'bg-sunken text-fg-muted' },
};

export function OrdersList({ orders }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xs border border-dashed border-line bg-page p-12 text-center">
        <Icon icon={Package} className="mx-auto size-12 stroke-1 text-fg-muted/40" />
        <h2 className="mt-4 type-h3 font-display text-fg">No Orders Yet</h2>
        <p className="mx-auto mt-2 max-w-sm type-body-sm text-fg-muted">
          Your personal commissions, lookbook orders, and sartorial purchases will appear here.
        </p>
        <Link href="/shop" className="mt-6 inline-block">
          <Button variant="primary" className="gap-2 text-xs tracking-widest uppercase">
            <Icon icon={ShoppingBag} className="size-4" />
            <span>Discover The Collection</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h1 className="type-h2 font-display text-fg">Order History</h1>
        <p className="type-body-sm text-fg-muted">
          Review your commissions, track ongoing courier dispatches, and request exchanges.
        </p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const badge = STATUS_BADGES[order.status] ?? {
            label: order.status,
            className: 'bg-sunken text-fg-muted',
          };
          const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={order.id}
              className="rounded-xs border border-line bg-raised p-6 transition-colors hover:border-fg/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="font-mono text-sm font-semibold tracking-wider text-fg transition-colors hover:text-accent-text"
                    >
                      {order.orderNumber}
                    </Link>
                    <span
                      className={`type-body-xs inline-flex items-center rounded-full px-2 py-0.5 font-medium tracking-wide uppercase ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="type-body-xs mt-1 text-fg-muted">Placed on {formattedDate}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="type-body-xs block text-fg-muted">Total Investment</span>
                    <Price
                      price={money(order.totalMinor, order.currency)}
                      className="font-medium text-fg"
                    />
                  </div>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="type-body-xs inline-flex items-center gap-1.5 rounded-xs bg-ink px-3 py-1.5 text-ivory transition-colors hover:bg-accent-text"
                  >
                    <span>View Commission</span>
                    <Icon icon={ArrowUpRight} className="size-3.5 text-ivory/80" />
                  </Link>
                  <Link
                    href={`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                    className="type-body-xs inline-flex items-center gap-1.5 rounded-xs border border-line bg-page px-2.5 py-1.5 text-fg-muted transition-colors hover:border-fg hover:text-fg"
                  >
                    <span>Track</span>
                  </Link>
                </div>
              </div>

              {/* Items List */}
              <div className="mt-4 divide-y divide-line/40">
                {order.items.map((item) => {
                  const mediaUrl = item.imageSnapshot || item.variant?.product?.media?.[0]?.url;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xs border border-line bg-sunken">
                        {mediaUrl ? (
                          <Image
                            src={mediaUrl}
                            alt={item.titleSnapshot}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="type-body-xs flex h-full w-full items-center justify-center text-fg-muted">
                            AUREN
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate type-body-sm font-medium text-fg">
                          {item.titleSnapshot}
                        </h4>
                        {item.variantTitleSnapshot && (
                          <p className="type-body-xs text-fg-muted">{item.variantTitleSnapshot}</p>
                        )}
                        <p className="type-body-xs mt-0.5 text-fg-muted">Qty: {item.quantity}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <Price
                          price={money(item.totalMinor, order.currency)}
                          className="type-body-sm font-medium text-fg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {order.status === 'delivered' && (
                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="type-body-xs text-fg-muted">
                    Doorstep size exchange available within 7 days of delivery
                  </span>
                  <Link
                    href={`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                    className="type-body-xs text-accent-text underline underline-offset-4 hover:text-accent-text/80"
                  >
                    Request Return / Exchange
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
