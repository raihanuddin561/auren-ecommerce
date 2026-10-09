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
  createExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from '@/modules/finance/actions';
import type { ExpenseCategoryItem, ExpenseCategoryType } from '@/modules/finance/types';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CategoriesTableProps {
  categories: ExpenseCategoryItem[];
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<ExpenseCategoryType>('marketing');
  const [isCogs, setIsCogs] = useState(false);
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createExpenseCategoryAction({
        name: name.trim(),
        type,
        isCogs,
        description: description.trim() ? description.trim() : null,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to create category');
        return;
      }

      toast.success('Category created successfully');
      setOpen(false);
      setName('');
      setDescription('');
      setIsCogs(false);
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;

    setDeletingId(id);
    try {
      const res = await deleteExpenseCategoryAction(id);
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to delete category');
        return;
      }
      toast.success('Category deleted');
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
          <h2 className="text-sm font-semibold text-ink">Expense Cost Centers</h2>
          <p className="text-stone text-xs">
            Configure direct product cost categories vs operating expenditure (OpEx) centers.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-canvas gap-1.5 bg-ink text-xs hover:bg-ink/90">
              <Plus className="h-3.5 w-3.5" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-canvas max-w-md border-line">
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg text-ink">
                  Add Cost Center Category
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="catName" className="text-stone text-xs">
                  Category Name *
                </Label>
                <Input
                  id="catName"
                  required
                  placeholder="e.g. Master Tailoring & Silks"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catType" className="text-stone text-xs">
                  Account Type *
                </Label>
                <select
                  id="catType"
                  value={type}
                  onChange={(e) => setType(e.target.value as ExpenseCategoryType)}
                  className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
                >
                  <option value="marketing">Marketing & Digital Ads</option>
                  <option value="payroll">Payroll & Artisan Wages</option>
                  <option value="rent">Studio Rent & Real Estate</option>
                  <option value="utilities">Power & Utilities</option>
                  <option value="software">Software & Cloud Services</option>
                  <option value="photography">Lookbook & Photography</option>
                  <option value="packaging_stock">Packaging & Boxes</option>
                  <option value="logistics">Inbound Logistics & Freight</option>
                  <option value="professional_fees">Legal & Professional Fees</option>
                  <option value="bank_charges">Bank & POS Fees</option>
                  <option value="misc">Miscellaneous</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isCogs"
                  checked={isCogs}
                  onChange={(e) => setIsCogs(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-line text-ink focus:ring-gold"
                />
                <Label htmlFor="isCogs" className="cursor-pointer text-xs font-medium text-ink">
                  Classify as Direct Cost of Goods Sold (COGS)
                </Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catDesc" className="text-stone text-xs">
                  Description
                </Label>
                <Input
                  id="catDesc"
                  placeholder="Notes on usage..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
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
                  {isSubmitting ? 'Saving...' : 'Create Category'}
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
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Category</th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Classification</th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Type Code</th>
              <th className="px-4 py-2.5 font-medium tracking-wider uppercase">
                Recorded Expenses
              </th>
              <th className="w-36 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                Total Spent
              </th>
              <th className="w-16 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-surface/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">{c.name}</div>
                  {c.description && <div className="text-stone text-xs">{c.description}</div>}
                </td>
                <td className="px-4 py-3">
                  {c.isCogs ? (
                    <Badge tone="gold">Direct COGS</Badge>
                  ) : (
                    <Badge tone="neutral">Operating OpEx</Badge>
                  )}
                </td>
                <td className="text-stone px-4 py-3 font-mono">{c.type}</td>
                <td className="text-stone px-4 py-3">{c.expenseCount} entries</td>
                <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap text-ink">
                  {c.totalSpentFormatted}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === c.id || c.expenseCount > 0}
                    onClick={() => handleDelete(c.id, c.name)}
                    className="text-stone h-7 w-7 p-0 hover:text-oxblood disabled:opacity-30"
                    title={
                      c.expenseCount > 0
                        ? 'Cannot delete category with recorded expenses'
                        : 'Delete'
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete category</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
