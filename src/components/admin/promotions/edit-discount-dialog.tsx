'use client';

import {
  AlertTriangle,
  Calendar,
  Check,
  Dices,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { getProductsByIdsForPicker, searchProductsForPicker } from '@/modules/catalog/actions';
import { updateDiscountAction } from '@/modules/promotions/actions';
import { generateCouponCode } from '@/modules/promotions/generator';
import type { DiscountType } from '@/modules/promotions/types';
import type { DiscountRow } from './discounts-table';

interface ProductPickerItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  status: string;
  imageUrl: string | null;
}

const PREFIX_OPTIONS = ['AUREN', 'VIP', 'FESTIVE', 'SPECIAL'] as const;

interface EditDiscountDialogProps {
  discount: DiscountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDiscountDialog({ discount, open, onOpenChange }: EditDiscountDialogProps) {
  if (!discount || !open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditDiscountDialogForm key={discount.id} discount={discount} onOpenChange={onOpenChange} />
    </Dialog>
  );
}

function EditDiscountDialogForm({
  discount,
  onOpenChange,
}: {
  discount: DiscountRow;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states initialized directly from discount
  const [code, setCode] = useState(discount.code ?? '');
  const [selectedPrefix, setSelectedPrefix] = useState<string>('AUREN');
  const [title, setTitle] = useState(discount.title);
  const [type, setType] = useState<DiscountType>(discount.type as DiscountType);
  const [value, setValue] = useState(discount.value.toString());
  const [minSubtotal, setMinSubtotal] = useState(
    discount.minSubtotalMinor ? (Number(discount.minSubtotalMinor) / 100).toString() : '',
  );
  const [maxDiscount, setMaxDiscount] = useState(
    discount.maxDiscountMinor ? (Number(discount.maxDiscountMinor) / 100).toString() : '',
  );
  const [usageLimit, setUsageLimit] = useState(
    discount.usageLimit ? discount.usageLimit.toString() : '',
  );
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    discount.usageLimitPerCustomer ? discount.usageLimitPerCustomer.toString() : '1',
  );
  const [customerEligibility, setCustomerEligibility] = useState<'all' | 'new'>(
    (discount.customerEligibility as 'all' | 'new') || 'all',
  );

  // Scope & Product-Wise Selection
  const [appliesTo, setAppliesTo] = useState<'order' | 'products'>(
    (discount.appliesTo as 'order' | 'products') || 'order',
  );
  const [selectedProducts, setSelectedProducts] = useState<ProductPickerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductPickerItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Expiration controls
  const [isUnlimited, setIsUnlimited] = useState<boolean>(!discount.endsAt);
  const [endsAt, setEndsAt] = useState(() => {
    if (discount.endsAt) {
      const date = new Date(discount.endsAt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    return '';
  });

  // Load initial targeted products asynchronously if product-wise
  useEffect(() => {
    if (discount.appliesTo === 'products' && discount.targetIds && discount.targetIds.length > 0) {
      let cancelled = false;
      getProductsByIdsForPicker({ ids: discount.targetIds }).then((res) => {
        if (!cancelled && res.ok) {
          setSelectedProducts(res.data);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [discount.appliesTo, discount.targetIds]);

  // Debounced product search
  useEffect(() => {
    if (appliesTo !== 'products') return;
    const term = searchQuery.trim();
    if (!term) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchProductsForPicker({
          q: term,
          excludeIds: selectedProducts.map((p) => p.id),
        });
        if (!cancelled && res.ok) {
          setSearchResults(res.data);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedProducts, appliesTo]);

  const hasRedemptions = discount.usageCount > 0;

  function handleGenerateCode(prefixToUse: string = selectedPrefix) {
    const generated = generateCouponCode({ prefix: prefixToUse });
    setCode(generated);
    toast.success('Generated new code', `Generated ${generated}`);
  }

  function applyPresetDate(daysAhead: number) {
    setIsUnlimited(false);
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    date.setHours(23, 59, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setEndsAt(local);
  }

  function applyEndOfMonth() {
    setIsUnlimited(false);
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const local = `${endOfMonth.getFullYear()}-${pad(endOfMonth.getMonth() + 1)}-${pad(endOfMonth.getDate())}T${pad(endOfMonth.getHours())}:${pad(endOfMonth.getMinutes())}`;
    setEndsAt(local);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setFormError(null);

    if (appliesTo === 'products' && selectedProducts.length === 0) {
      setFormError('Please select at least one product for this product-wise promotion.');
      setLoading(false);
      return;
    }

    if (usageLimit && Number(usageLimit) < discount.usageCount) {
      setFormError(
        `Total usage cap cannot be lower than existing customer redemptions (${discount.usageCount}).`,
      );
      setLoading(false);
      return;
    }

    const cleanCode = code.trim() ? code.trim().toUpperCase() : null;

    const payload = {
      id: discount.id,
      code: cleanCode,
      title: title.trim(),
      type,
      value: Number(value) || 0,
      appliesTo,
      targetIds: appliesTo === 'products' ? selectedProducts.map((p) => p.id) : [],
      minSubtotal: minSubtotal ? Number(minSubtotal) : null,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      customerEligibility,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usageLimitPerCustomer: usageLimitPerCustomer ? Number(usageLimitPerCustomer) : null,
      endsAt: isUnlimited || !endsAt ? null : new Date(endsAt),
    };

    const res = await updateDiscountAction(payload);
    setLoading(false);

    if (res.ok) {
      toast.success(
        cleanCode ? `Coupon ${cleanCode} updated` : 'Promotion updated',
        isUnlimited
          ? 'Validity is set to Unlimited Expiry.'
          : `Valid until ${new Date(endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
      );
      onOpenChange(false);
      router.refresh();
    } else {
      setFormError(res.error.message ?? 'Failed to update promotion.');
    }
  }

  return (
    <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Coupon / Promotion</DialogTitle>
        <DialogDescription>
          Update promotion rules, discount value, scope, and expiration dates.
        </DialogDescription>
      </DialogHeader>

      {hasRedemptions ? (
        <div className="flex items-start gap-2.5 rounded-xs border border-warning/40 bg-warning/10 p-3 text-xs text-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />
          <div>
            <p className="font-medium text-fg">Active Client Redemptions</p>
            <p className="mt-0.5 text-fg-muted">
              This coupon has already been redeemed in{' '}
              <strong className="text-fg">{discount.usageCount} order(s)</strong>. Past completed
              orders will retain their historic receipts; changes will apply to future checkouts.
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
        {/* Coupon Code Section */}
        <div className="flex flex-col gap-2 rounded-xs border border-line bg-sunken/40 p-3.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 type-small font-medium text-fg">
              <Tag className="h-4 w-4 text-gold" />
              Coupon Code
            </label>
            <div className="flex items-center gap-1">
              <span className="type-caption text-fg-muted">Preset:</span>
              {PREFIX_OPTIONS.map((prefix) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => {
                    setSelectedPrefix(prefix);
                    handleGenerateCode(prefix);
                  }}
                  className={cn(
                    'rounded-xs px-1.5 py-0.5 type-caption transition-colors',
                    selectedPrefix === prefix
                      ? 'border border-gold/40 bg-gold/15 font-medium text-gold-strong dark:text-gold'
                      : 'border border-line bg-page text-fg-muted hover:text-fg',
                  )}
                >
                  {prefix}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Leave blank for automatic rule, or enter code (e.g. AUREN-7X9K2M)"
              className="font-mono text-sm tracking-wider uppercase"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleGenerateCode()}
              className="shrink-0"
            >
              <Dices className="mr-1.5 h-3.5 w-3.5 text-gold" />
              Generate
            </Button>
          </div>
        </div>

        {/* Title */}
        <FormField label="Campaign Title / Note" required>
          {(props) => (
            <Input
              {...props}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 15% VIP Client Appreciation"
              required
            />
          )}
        </FormField>

        {/* Discount Type and Value */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="type-small font-medium text-fg">Discount Type</label>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as DiscountType;
                setType(t);
                if (t === 'percentage') setValue('10');
                else if (t === 'fixed_amount') setValue('500');
              }}
              className="h-10 rounded-xs border border-line bg-page px-3 text-sm text-fg focus:border-gold focus:outline-none"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed Amount (৳ BDT)</option>
              <option value="free_shipping">Complimentary Free Shipping</option>
            </select>
          </div>

          {type !== 'free_shipping' ? (
            <div className="flex flex-col gap-1.5">
              <FormField
                label={type === 'percentage' ? 'Percentage Discount (%)' : 'Amount (BDT ৳)'}
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min="0"
                    step={type === 'percentage' ? '1' : '50'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                )}
              </FormField>
              {/* Quick Presets */}
              <div className="mt-1 flex items-center gap-1.5">
                {type === 'percentage' ? (
                  <>
                    {[10, 15, 20, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setValue(pct.toString())}
                        className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                      >
                        {pct}%
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[250, 500, 1000, 1500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setValue(amt.toString())}
                        className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xs border border-line bg-sunken/40 px-3 py-2 text-sm text-fg-muted">
              <Check className="h-4 w-4 text-success" />
              <span>Waives standard & express shipping charges across 64 districts.</span>
            </div>
          )}
        </div>

        {/* Promotion Scope: Entire Order vs Product-Wise % */}
        <div className="flex flex-col gap-3 rounded-xs border border-line/70 bg-sunken/40 p-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 type-small font-medium text-fg">
              <Layers className="h-4 w-4 text-gold" />
              Promotion Scope
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAppliesTo('order')}
                className={cn(
                  'rounded-xs px-2.5 py-1 type-caption font-medium transition-colors',
                  appliesTo === 'order'
                    ? 'border border-gold/40 bg-gold/15 text-gold-strong dark:text-gold'
                    : 'border border-line bg-page text-fg-muted hover:text-fg',
                )}
              >
                Entire Order
              </button>
              <button
                type="button"
                onClick={() => setAppliesTo('products')}
                className={cn(
                  'rounded-xs px-2.5 py-1 type-caption font-medium transition-colors',
                  appliesTo === 'products'
                    ? 'border border-gold/40 bg-gold/15 text-gold-strong dark:text-gold'
                    : 'border border-line bg-page text-fg-muted hover:text-fg',
                )}
              >
                Specific Products (Product-wise %)
              </button>
            </div>
          </div>

          {appliesTo === 'products' ? (
            <div className="flex flex-col gap-3 border-t border-line/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="type-caption text-fg-muted">
                  This coupon will apply exclusively to the selected products below.
                </span>
                <Badge tone={selectedProducts.length > 0 ? 'gold' : 'neutral'}>
                  {selectedProducts.length} Product
                  {selectedProducts.length === 1 ? '' : 's'} Selected
                </Badge>
              </div>

              {/* Selected Products Chips */}
              {selectedProducts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="inline-flex items-center gap-2 rounded-xs border border-gold/40 bg-gold/5 py-1 pr-2 pl-1.5"
                    >
                      {prod.imageUrl ? (
                        <div className="bg-subtle relative h-6 w-5 shrink-0 overflow-hidden rounded-xs">
                          <Image
                            src={prod.imageUrl}
                            alt={prod.title}
                            fill
                            sizes="24px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <ShoppingBag className="h-4 w-4 shrink-0 text-gold" />
                      )}
                      <span className="max-w-[140px] truncate type-caption font-medium text-fg">
                        {prod.title}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProducts((prev) => prev.filter((p) => p.id !== prod.id))
                        }
                        aria-label={`Remove ${prod.title}`}
                        className="text-fg-muted transition-colors hover:text-danger-text"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Product Search Input */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-fg-muted">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </div>
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setSearchResults([]);
                      setIsSearching(false);
                    }
                  }}
                  placeholder="Search product by title (e.g. Linen, Polo, Shirt)..."
                  className="pl-9 text-xs"
                />
              </div>

              {/* Search Results Dropdown List */}
              {searchResults.length > 0 ? (
                <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-xs border border-line bg-page p-1">
                  {searchResults.map((item) => (
                    <li
                      key={item.id}
                      className="hover:bg-hover flex items-center justify-between rounded-xs p-2 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {item.imageUrl ? (
                          <div className="bg-subtle relative h-8 w-6 shrink-0 overflow-hidden rounded-xs">
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="bg-subtle flex h-8 w-6 shrink-0 items-center justify-center rounded-xs text-fg-muted">
                            <ShoppingBag className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate type-caption font-medium text-fg">{item.title}</p>
                          <p className="truncate type-caption text-fg-muted">/{item.slug}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedProducts((prev) => [...prev, item]);
                          setSearchResults((prev) => prev.filter((p) => p.id !== item.id));
                        }}
                        className="h-7 shrink-0 px-2.5 type-caption"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim() && !isSearching ? (
                <p className="px-1 type-caption text-fg-muted italic">
                  No matching products found.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Expiration Rules (Unlimited vs Scheduled) */}
        <div className="flex flex-col gap-3 rounded-xs border border-line/70 bg-sunken/40 p-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 type-small font-medium text-fg">
              <Calendar className="h-4 w-4 text-gold" />
              Expiration & Validity Window
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUnlimited(true);
                  setEndsAt('');
                }}
                className={cn(
                  'flex items-center gap-1 rounded-xs px-2.5 py-1 type-caption font-medium transition-colors',
                  isUnlimited
                    ? 'border border-gold/40 bg-gold/15 text-gold-strong dark:text-gold'
                    : 'border border-line bg-page text-fg-muted hover:text-fg',
                )}
              >
                <InfinityIcon className="h-3.5 w-3.5" />
                Unlimited Expiry
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUnlimited(false);
                  if (!endsAt) applyPresetDate(14);
                }}
                className={cn(
                  'rounded-xs px-2.5 py-1 type-caption font-medium transition-colors',
                  !isUnlimited
                    ? 'border border-gold/40 bg-gold/15 text-gold-strong dark:text-gold'
                    : 'border border-line bg-page text-fg-muted hover:text-fg',
                )}
              >
                Set Expiration Date
              </button>
            </div>
          </div>

          {isUnlimited ? (
            <div className="flex items-center gap-2 rounded-xs border border-gold/30 bg-gold/5 p-3 type-small text-fg">
              <Badge tone="gold" className="shrink-0">
                Never Expires
              </Badge>
              <span>
                This coupon has <strong>unlimited expiry</strong>. It will remain valid indefinitely
                until manually deactivated.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <FormField label="Expires At (End of Date)">
                {(props) => (
                  <Input
                    {...props}
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required={!isUnlimited}
                  />
                )}
              </FormField>
              <div className="flex items-center gap-2 type-caption text-fg-muted">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPresetDate(7)}
                  className="rounded-xs border border-line bg-page px-2 py-0.5 hover:border-gold hover:text-fg"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetDate(14)}
                  className="rounded-xs border border-line bg-page px-2 py-0.5 hover:border-gold hover:text-fg"
                >
                  +14 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetDate(30)}
                  className="rounded-xs border border-line bg-page px-2 py-0.5 hover:border-gold hover:text-fg"
                >
                  +30 Days
                </button>
                <button
                  type="button"
                  onClick={applyEndOfMonth}
                  className="rounded-xs border border-line bg-page px-2 py-0.5 hover:border-gold hover:text-fg"
                >
                  End of Month
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rules & Guardrails */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Minimum Order Subtotal (BDT ৳)"
            hint="Minimum spend required before discount applies"
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="50"
                placeholder="e.g. 2000"
                value={minSubtotal}
                onChange={(e) => setMinSubtotal(e.target.value)}
              />
            )}
          </FormField>

          {type === 'percentage' ? (
            <FormField
              label="Maximum Discount Cap (BDT ৳)"
              hint="Ceiling on total discount deducted"
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="50"
                  placeholder="e.g. 1000"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
              )}
            </FormField>
          ) : null}
        </div>

        {/* Usage Caps */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Total Usage Cap"
            hint={hasRedemptions ? `Current redemptions: ${discount.usageCount}` : 'Overall limit'}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={discount.usageCount || 1}
                placeholder="Leave empty for unlimited"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Per-Client Cap" hint="Redemptions per customer">
            {(props) => (
              <Input
                {...props}
                type="number"
                min="1"
                value={usageLimitPerCustomer}
                onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-1.5">
            <label className="type-small font-medium text-fg">Client Eligibility</label>
            <select
              value={customerEligibility}
              onChange={(e) => setCustomerEligibility(e.target.value as 'all' | 'new')}
              className="h-10 rounded-xs border border-line bg-page px-3 text-sm text-fg focus:border-gold focus:outline-none"
            >
              <option value="all">All Clients</option>
              <option value="new">First Order Only</option>
            </select>
          </div>
        </div>

        {/* Live Luxury Coupon Ticket Preview */}
        <div className="flex flex-col gap-2 rounded-xs border border-gold/40 bg-raised p-4 shadow-float">
          <div className="flex items-center justify-between">
            <span className="type-eyebrow tracking-eyebrow text-accent-text uppercase">
              ✦ Voucher Preview (Updated)
            </span>
            <Badge tone={isUnlimited ? 'gold' : 'success'}>
              {isUnlimited ? 'Never Expires' : 'Scheduled Expiry'}
            </Badge>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <p className="type-h3 font-mono tracking-wider text-fg">
                {code ? code.toUpperCase() : 'AUTOMATIC PROMOTION'}
              </p>
              <p className="type-small text-fg-muted">
                {title || 'Exclusive client promotional consideration'}
              </p>
            </div>
            <div className="text-right">
              <p className="type-h2 font-serif text-gold">
                {type === 'percentage'
                  ? `${value}% OFF`
                  : type === 'fixed_amount'
                    ? `৳${value} OFF`
                    : 'FREE DELIVERY'}
              </p>
              {appliesTo === 'products' ? (
                <p className="type-caption font-sans font-medium text-gold-strong dark:text-gold">
                  Product-wise ({selectedProducts.length} selected)
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-2 type-caption font-mono text-fg-muted">
            {appliesTo === 'products' ? (
              <span className="text-gold-strong dark:text-gold">
                ✦ Product-wise ({selectedProducts.length} item
                {selectedProducts.length === 1 ? '' : 's'})
              </span>
            ) : (
              <span>✦ Entire Order</span>
            )}
            {minSubtotal ? <span>· Min. Order ৳{minSubtotal}</span> : <span>· No Min. Spend</span>}
            {maxDiscount ? <span>· Max Cap ৳{maxDiscount}</span> : null}
            <span>
              · {usageLimitPerCustomer ? `${usageLimitPerCustomer}x/client` : 'Unlimited'}
            </span>
            <span>
              · {isUnlimited ? 'Never Expires (Unlimited)' : `Expires: ${endsAt || 'Unset'}`}
            </span>
          </div>
        </div>

        {formError ? (
          <p role="alert" className="type-small text-danger-text">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
