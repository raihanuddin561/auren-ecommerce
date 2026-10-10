'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createExpenseAction } from '@/modules/finance/actions';
import type { ExpenseCategoryItem, MarketingCampaignItem } from '@/modules/finance/types';
import { fromDecimalString } from '@/lib/money';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface CreateExpenseDialogProps {
  categories: ExpenseCategoryItem[];
  campaigns: MarketingCampaignItem[];
}

export function CreateExpenseDialog({ categories, campaigns }: CreateExpenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [campaignId, setCampaignId] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [amountBdt, setAmountBdt] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let amountMinor = 0n;
    try {
      amountMinor = fromDecimalString(amountBdt.trim(), 'BDT').minor;
      if (amountMinor <= 0n) {
        toast.error('Please enter a valid expense amount in BDT');
        return;
      }
    } catch {
      toast.error('Please enter a valid expense amount in BDT');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createExpenseAction({
        expenseDate,
        categoryId,
        campaignId: campaignId ? campaignId : null,
        vendor: vendor.trim(),
        description: description.trim(),
        amountMinor,
        currency: 'BDT',
        paymentMethod,
        reference: reference.trim() ? reference.trim() : null,
        attachmentUrl: attachmentUrl.trim() ? attachmentUrl.trim() : null,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to record expense');
        return;
      }

      toast.success('Expense recorded successfully');
      setOpen(false);
      setVendor('');
      setDescription('');
      setAmountBdt('');
      setReference('');
      setAttachmentUrl('');
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-ink text-xs text-ivory hover:bg-ink/90">
          <Plus className="h-3.5 w-3.5" />
          Record Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg border-line bg-raised">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-fg">Record Atelier Expense</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expenseDate" className="text-xs text-fg-muted">
                Expense Date *
              </Label>
              <Input
                id="expenseDate"
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-9 border-line bg-page text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="text-xs text-fg-muted">
                Expense Category *
              </Label>
              <select
                id="categoryId"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isCogs ? '(COGS)' : '(OpEx)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendor" className="text-xs text-fg-muted">
                Payee / Vendor *
              </Label>
              <Input
                id="vendor"
                required
                placeholder="e.g. Italian Wool Mills, Banani Electric"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="h-9 border-line bg-page text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amountBdt" className="text-xs text-fg-muted">
                Amount (BDT ৳) *
              </Label>
              <Input
                id="amountBdt"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="15000.00"
                value={amountBdt}
                onChange={(e) => setAmountBdt(e.target.value)}
                className="h-9 border-line bg-page font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs text-fg-muted">
              Description / Notes *
            </Label>
            <Input
              id="description"
              required
              placeholder="e.g. 50 meters superfine Giza 87 Egyptian cotton"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 border-line bg-page text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="text-xs text-fg-muted">
                Payment Method
              </Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-9 w-full rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
              >
                <option value="bank_transfer">Bank Transfer (EFT / RTGS)</option>
                <option value="bkash_corporate">bKash Merchant / Corporate</option>
                <option value="corporate_card">Corporate Credit Card</option>
                <option value="cash">Petty Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reference" className="text-xs text-fg-muted">
                Reference / Invoice #
              </Label>
              <Input
                id="reference"
                placeholder="INV-2026-089"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-9 border-line bg-page text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaignId" className="text-xs text-fg-muted">
              Attribute to Marketing Campaign (Optional)
            </Label>
            <select
              id="campaignId"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="h-9 w-full rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
            >
              <option value="">None / General Operations</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.channel})
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-line text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-ink text-xs text-ivory hover:bg-ink/90"
            >
              {isSubmitting ? 'Recording...' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
