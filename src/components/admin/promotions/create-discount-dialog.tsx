'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { createDiscountAction } from '@/modules/promotions/actions';
import type { DiscountType } from '@/modules/promotions/types';

export function CreateDiscountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('10');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState('1');
  const [customerEligibility, setCustomerEligibility] = useState<'all' | 'new'>('all');
  const [endsAt, setEndsAt] = useState('');

  function reset() {
    setCode('');
    setTitle('');
    setType('percentage');
    setValue('10');
    setMinSubtotal('');
    setMaxDiscount('');
    setUsageLimit('');
    setUsageLimitPerCustomer('1');
    setCustomerEligibility('all');
    setEndsAt('');
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const payload = {
      code: code.trim() ? code.trim().toUpperCase() : null,
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
      endsAt: endsAt ? new Date(endsAt) : null,
      isActive: true,
      combinable: false,
    };

    const res = await createDiscountAction(payload);
    setLoading(false);

    if (res.ok) {
      toast.success('Promotion created successfully');
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
          Create Promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New Promotion</DialogTitle>
          <DialogDescription>
            Create a discount code or automatic promotional rule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Coupon Code" hint="Leave blank for automatic rule">
              {(props) => (
                <Input
                  {...props}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                />
              )}
            </FormField>

            <FormField label="Title" required>
              {(props) => (
                <Input
                  {...props}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 10% Off First Commission"
                  required
                />
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="type-small font-medium text-fg">Discount Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DiscountType)}
                className="rounded h-10 border border-line bg-page px-3 text-sm text-fg focus:border-gold focus:outline-none"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (৳)</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>

            {type !== 'free_shipping' ? (
              <FormField
                label={type === 'percentage' ? 'Percentage Value (%)' : 'Amount (BDT ৳)'}
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
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Minimum Subtotal (৳)" hint="Optional threshold">
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
              <FormField label="Max Discount Cap (৳)" hint="Optional upper limit">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 1000"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                )}
              </FormField>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Total Usage Limit" hint="Blank = unlimited">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                />
              )}
            </FormField>

            <FormField label="Limit Per Client" hint="Default = 1">
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
                className="rounded h-10 border border-line bg-page px-3 text-sm text-fg focus:border-gold focus:outline-none"
              >
                <option value="all">All Clients</option>
                <option value="new">First Order Only</option>
              </select>
            </div>
          </div>

          <FormField label="Expiration Date" hint="Optional end datetime">
            {(props) => (
              <Input
                {...props}
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            )}
          </FormField>

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
              Create Promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
