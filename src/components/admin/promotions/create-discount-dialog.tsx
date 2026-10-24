'use client';

import {
  Calendar,
  Check,
  Dices,
  Infinity as InfinityIcon,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { createDiscountAction } from '@/modules/promotions/actions';
import { generateCouponCode } from '@/modules/promotions/generator';
import type { DiscountType } from '@/modules/promotions/types';

const PREFIX_OPTIONS = ['AUREN', 'VIP', 'FESTIVE', 'SPECIAL'] as const;

export function CreateDiscountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Core coupon attributes
  const [code, setCode] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState<string>('AUREN');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('10');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState('1');
  const [customerEligibility, setCustomerEligibility] = useState<'all' | 'new'>('all');

  // Expiration controls
  const [isUnlimited, setIsUnlimited] = useState<boolean>(true);
  const [endsAt, setEndsAt] = useState('');

  function handleGenerateCode(prefixToUse: string = selectedPrefix) {
    const generated = generateCouponCode({ prefix: prefixToUse });
    setCode(generated);
    if (!title) {
      if (type === 'percentage') {
        setTitle(`${value}% Off Luxury Commission (${generated})`);
      } else if (type === 'fixed_amount') {
        setTitle(`৳${value} Off Commission (${generated})`);
      } else {
        setTitle(`Complimentary Delivery (${generated})`);
      }
    }
    toast.success('Generated code', `Created ${generated}`);
  }

  function applyPresetDate(daysAhead: number) {
    setIsUnlimited(false);
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    date.setHours(23, 59, 0, 0);
    // Format to YYYY-MM-DDThh:mm for datetime-local
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

  function reset() {
    setCode('');
    setSelectedPrefix('AUREN');
    setTitle('');
    setType('percentage');
    setValue('10');
    setMinSubtotal('');
    setMaxDiscount('');
    setUsageLimit('');
    setUsageLimitPerCustomer('1');
    setCustomerEligibility('all');
    setIsUnlimited(true);
    setEndsAt('');
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const cleanCode = code.trim() ? code.trim().toUpperCase() : null;

    const payload = {
      code: cleanCode,
      title: title.trim(),
      type,
      value: Number(value) || 0,
      appliesTo: 'order' as const,
      targetIds: [],
      minSubtotal: minSubtotal ? Number(minSubtotal) : null,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      customerEligibility,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usageLimitPerCustomer: usageLimitPerCustomer ? Number(usageLimitPerCustomer) : null,
      startsAt: new Date(),
      // If unlimited or date not chosen, endsAt is null
      endsAt: isUnlimited || !endsAt ? null : new Date(endsAt),
      isActive: true,
      combinable: false,
    };

    const res = await createDiscountAction(payload);
    setLoading(false);

    if (res.ok) {
      toast.success(
        cleanCode ? `Coupon ${cleanCode} created` : 'Promotion created',
        isUnlimited
          ? 'Unlimited validity (never expires).'
          : 'Configured with expiration schedule.',
      );
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setFormError(res.error.message ?? 'Failed to create discount');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Promotion / Coupon
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-gold" />
            <DialogTitle>Generate Coupon / Promotion</DialogTitle>
          </div>
          <DialogDescription>
            Generate high-entropy branded promo codes with unlimited validity or scheduled
            expiration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-5">
          {/* Code Generation Section */}
          <div className="flex flex-col gap-3 rounded-xs border border-line/70 bg-sunken/40 p-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 type-small font-medium text-fg">
                <Sparkles className="h-4 w-4 text-gold" />
                Coupon Code
              </label>
              <div className="flex items-center gap-1">
                {PREFIX_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelectedPrefix(p);
                      handleGenerateCode(p);
                    }}
                    className={cn(
                      'rounded-xs px-2 py-0.5 type-caption font-mono transition-colors',
                      selectedPrefix === p
                        ? 'border border-gold/40 bg-gold/15 text-gold-strong'
                        : 'border border-line bg-page text-fg-muted hover:text-fg',
                    )}
                  >
                    {p}-
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AUREN-7X9K2M (or leave blank for automatic rule)"
                  className="font-mono tracking-wider"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleGenerateCode(selectedPrefix)}
                className="flex shrink-0 items-center gap-1.5"
              >
                <Dices className="h-4 w-4 text-gold" />
                Generate Code
              </Button>
            </div>
            <p className="type-caption text-fg-muted">
              Auto-generator uses unambiguous entropy (excludes 0, O, 1, I, L) to prevent customer
              typos.
            </p>
          </div>

          {/* Promotion Title */}
          <FormField
            label="Internal Title / Campaign Name"
            required
            hint="Identifies this promotion in order profit logs and reports"
          >
            {(props) => (
              <Input
                {...props}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 10% Off Private Salon Debut"
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

          {/* Expiration Rules (Highlighting Unlimited Expiry) */}
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
                      ? 'border border-gold/40 bg-gold/15 text-gold-strong'
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
                      ? 'border border-gold/40 bg-gold/15 text-gold-strong'
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
                  This coupon has <strong>unlimited expiry</strong>. It will remain valid
                  indefinitely until manually deactivated or until redemption limits are exhausted.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-caption text-fg-muted">Quick presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetDate(7)}
                    className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetDate(14)}
                    className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                  >
                    +14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetDate(30)}
                    className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                  >
                    +30 Days
                  </button>
                  <button
                    type="button"
                    onClick={applyEndOfMonth}
                    className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption text-fg-muted hover:border-gold hover:text-fg"
                  >
                    End of Month
                  </button>
                </div>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full sm:w-72"
                />
              </div>
            )}
          </div>

          {/* Safety Thresholds */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Minimum Order Subtotal (৳)" hint="Optional order qualification limit">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 3000"
                  value={minSubtotal}
                  onChange={(e) => setMinSubtotal(e.target.value)}
                />
              )}
            </FormField>

            {type === 'percentage' ? (
              <FormField
                label="Max Discount Cap (৳)"
                hint="Essential cap to prevent blowout losses on large orders"
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 1500"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                )}
              </FormField>
            ) : (
              <div className="flex flex-col justify-center rounded-xs border border-line/60 bg-sunken/20 px-3 py-2 text-xs text-fg-muted">
                Fixed discounts deduct precisely ৳{value || 0} without requiring a percentage cap.
              </div>
            )}
          </div>

          {/* Usage Guardrails */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Total Usage Limit" hint="Blank = unlimited uses">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                />
              )}
            </FormField>

            <FormField label="Limit Per Client" hint="Default = 1 use">
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
                ✦ Voucher Preview
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
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-2 type-caption font-mono text-fg-muted">
              {minSubtotal ? <span>Min. Order ৳{minSubtotal}</span> : <span>No Min. Spend</span>}
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Coupon / Promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
