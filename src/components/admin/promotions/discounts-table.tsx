'use client';

import { Check, Copy, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { toggleDiscountAction } from '@/modules/promotions/actions';
import { DiscountStatusBadge } from './discount-status-badge';

export interface DiscountRow {
  id: string;
  code: string | null;
  title: string;
  type: string;
  value: number;
  appliesTo: string;
  targetIds: string[];
  minSubtotalMinor: string | null;
  maxDiscountMinor: string | null;
  customerEligibility: string;
  usageCount: number;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

interface DiscountsTableProps {
  discounts: DiscountRow[];
  total: number;
  canManage: boolean;
}

export function DiscountsTable({ discounts, total, canManage }: DiscountsTableProps) {
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggle(id: string, currentActive: boolean) {
    setTogglingId(id);
    const res = await toggleDiscountAction({ id, isActive: !currentActive });
    setTogglingId(null);

    if (res.ok) {
      toast.success(currentActive ? 'Promotion deactivated' : 'Promotion activated');
      router.refresh();
    } else {
      toast.error(res.error.message ?? 'Failed to update status');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Copied coupon code', code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xs border border-line bg-raised">
        <table className="w-full text-left text-sm">
          <thead className="bg-subtle border-b border-line text-xs font-medium tracking-wider text-fg-muted uppercase">
            <tr>
              <th className="px-4 py-3">Promotion / Coupon</th>
              <th className="px-4 py-3">Benefit</th>
              <th className="px-4 py-3">Rules & Guardrails</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Validity & Expiry</th>
              {canManage ? <th className="px-4 py-3 text-right">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-fg">
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                  No promotional discounts found.
                </td>
              </tr>
            ) : (
              discounts.map((discount) => {
                const isToggling = togglingId === discount.id;
                const isNeverExpires = !discount.endsAt;
                return (
                  <tr key={discount.id} className="hover:bg-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {discount.code ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xs border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-gold-strong uppercase dark:text-gold">
                              <Tag className="h-3 w-3 text-gold" />
                              {discount.code}
                              <button
                                type="button"
                                onClick={() => copyCode(discount.code!)}
                                className="ml-1 text-fg-muted transition-colors hover:text-fg"
                                title="Copy code"
                              >
                                {copiedCode === discount.code ? (
                                  <Check className="h-3.5 w-3.5 text-success" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </span>
                          ) : (
                            <span className="rounded-xs border border-line bg-page px-1.5 py-0.5 type-caption text-fg-muted">
                              Automatic Rule
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-fg">{discount.title}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        {discount.type === 'percentage' ? (
                          <span className="font-mono font-semibold text-fg">
                            {discount.value}% OFF
                          </span>
                        ) : discount.type === 'fixed_amount' ? (
                          <span className="font-mono font-semibold text-fg">
                            ৳{discount.value} OFF
                          </span>
                        ) : (
                          <span className="font-semibold text-fg">Free Delivery</span>
                        )}
                        {discount.appliesTo === 'products' ? (
                          <span className="type-caption font-medium text-gold-strong dark:text-gold">
                            Product-wise ({discount.targetIds.length} item
                            {discount.targetIds.length === 1 ? '' : 's'})
                          </span>
                        ) : (
                          <span className="type-caption text-fg-muted">Entire order</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col font-mono text-xs text-fg-muted">
                        {discount.minSubtotalMinor ? (
                          <span>Min: ৳{Number(discount.minSubtotalMinor) / 100}</span>
                        ) : null}
                        {discount.maxDiscountMinor ? (
                          <span>Cap: ৳{Number(discount.maxDiscountMinor) / 100}</span>
                        ) : null}
                        {discount.customerEligibility === 'new' ? (
                          <span className="font-sans font-medium text-accent-text">
                            New clients only
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-fg">
                          {discount.usageCount}
                          {discount.usageLimit ? ` / ${discount.usageLimit}` : ' used'}
                        </span>
                        {discount.usageLimitPerCustomer ? (
                          <span className="type-caption text-fg-muted">
                            Max {discount.usageLimitPerCustomer}/client
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <DiscountStatusBadge
                          isActive={discount.isActive}
                          startsAt={discount.startsAt}
                          endsAt={discount.endsAt}
                        />
                        <span className="type-caption font-mono text-fg-muted">
                          {isNeverExpires
                            ? 'Never expires'
                            : `Expires: ${new Date(discount.endsAt!).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}`}
                        </span>
                      </div>
                    </td>

                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isToggling}
                          loading={isToggling}
                          onClick={() => handleToggle(discount.id, discount.isActive)}
                        >
                          {discount.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="type-eyebrow text-fg-muted">
        Showing {discounts.length} of {total} promotions
      </p>
    </div>
  );
}
