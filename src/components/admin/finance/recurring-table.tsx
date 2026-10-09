'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  updateRecurringExpenseAction,
} from '@/modules/finance/actions';
import type {
  ExpenseCategoryItem,
  RecurringExpenseCadence,
  RecurringExpenseItem,
} from '@/modules/finance/types';
import { fromDecimalString } from '@/lib/money';
import { Plus, Trash2, Power } from 'lucide-react';
import { toast } from 'sonner';

interface RecurringTableProps {
  recurring: RecurringExpenseItem[];
  categories: ExpenseCategoryItem[];
}

export function RecurringTable({ recurring, categories }: RecurringTableProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [vendor, setVendor] = useState('');
  const [amountBdt, setAmountBdt] = useState('');
  const [cadence, setCadence] = useState<RecurringExpenseCadence>('monthly');
  const [dayOfPeriod, setDayOfPeriod] = useState(1);
  const [startsOn, setStartsOn] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [endsOn, setEndsOn] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let amountMinor = 0n;
    try {
      amountMinor = fromDecimalString(amountBdt.trim(), 'BDT').minor;
      if (amountMinor <= 0n) {
        toast.error('Please enter a valid amount in BDT');
        return;
      }
    } catch {
      toast.error('Please enter a valid amount in BDT');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createRecurringExpenseAction({
        categoryId,
        vendor: vendor.trim(),
        amountMinor,
        currency: 'BDT',
        cadence,
        dayOfPeriod,
        startsOn,
        endsOn: endsOn ? endsOn : null,
        isActive: true,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to create recurring commitment');
        return;
      }

      toast.success('Recurring expense scheduled');
      setOpen(false);
      setVendor('');
      setAmountBdt('');
      setEndsOn('');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: RecurringExpenseItem) => {
    try {
      const res = await updateRecurringExpenseAction({
        id: item.id,
        isActive: !item.isActive,
      });
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to update status');
        return;
      }
      toast.success(item.isActive ? 'Template paused' : 'Template activated');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (id: string, vendorName: string) => {
    if (!confirm(`Are you sure you want to delete recurring expense template for "${vendorName}"?`))
      return;

    setDeletingId(id);
    try {
      const res = await deleteRecurringExpenseAction(id);
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to delete template');
        return;
      }
      toast.success('Template deleted');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-canvas flex items-center justify-between rounded-sm border border-line p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Recurring Atelier Commitments</h2>
          <p className="text-stone text-xs">
            Automated recurring expenses (rent, utilities, software, artisan retainers) generated
            via background cron.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-canvas gap-1.5 bg-ink text-xs hover:bg-ink/90">
              <Plus className="h-3.5 w-3.5" />
              Add Recurring OpEx
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-canvas max-w-md border-line">
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg text-ink">
                  Schedule Recurring Expense
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="recCategory" className="text-stone text-xs">
                  Category *
                </Label>
                <select
                  id="recCategory"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recVendor" className="text-stone text-xs">
                    Vendor / Landlord *
                  </Label>
                  <Input
                    id="recVendor"
                    required
                    placeholder="e.g. Banani Holdings"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recAmount" className="text-stone text-xs">
                    Amount (BDT ৳) *
                  </Label>
                  <Input
                    id="recAmount"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="120000.00"
                    value={amountBdt}
                    onChange={(e) => setAmountBdt(e.target.value)}
                    className="bg-surface h-9 border-line font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cadence" className="text-stone text-xs">
                    Frequency *
                  </Label>
                  <select
                    id="cadence"
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as RecurringExpenseCadence)}
                    className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dayOfPeriod" className="text-stone text-xs">
                    Day of Month (1–31)
                  </Label>
                  <Input
                    id="dayOfPeriod"
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfPeriod}
                    onChange={(e) => setDayOfPeriod(parseInt(e.target.value) || 1)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recStartsOn" className="text-stone text-xs">
                    Effective From *
                  </Label>
                  <Input
                    id="recStartsOn"
                    type="date"
                    required
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recEndsOn" className="text-stone text-xs">
                    Expires On (Optional)
                  </Label>
                  <Input
                    id="recEndsOn"
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>
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
                  className="text-canvas bg-ink text-xs hover:bg-ink/90"
                >
                  {isSubmitting ? 'Saving...' : 'Set Schedule'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-canvas overflow-hidden rounded-sm border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface/50 text-stone border-b border-line text-left">
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">
                Vendor / Commitment
              </th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Category</th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Cadence</th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Scheduled Day</th>
              <th className="w-36 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                Amount
              </th>
              <th className="w-24 px-4 py-2.5 font-medium tracking-wider uppercase">Status</th>
              <th className="w-24 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {recurring.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-stone py-8 text-center">
                  No recurring expense commitments scheduled yet.
                </td>
              </tr>
            ) : (
              recurring.map((item) => (
                <tr key={item.id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-ink">{item.vendor}</td>
                  <td className="text-stone px-4 py-3">{item.categoryName}</td>
                  <td className="px-4 py-3 font-medium text-ink capitalize">
                    <Badge tone="neutral">{item.cadence}</Badge>
                  </td>
                  <td className="text-stone px-4 py-3 font-mono">Day {item.dayOfPeriod}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap text-ink">
                    {item.amountFormatted}
                  </td>
                  <td className="px-4 py-3">
                    {item.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Paused</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(item)}
                        className="text-stone h-7 w-7 p-0 hover:text-ink"
                        title={item.isActive ? 'Pause' : 'Activate'}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span className="sr-only">Toggle active</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id, item.vendor)}
                        className="text-stone h-7 w-7 p-0 hover:text-oxblood"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
