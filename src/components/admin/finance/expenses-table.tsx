'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteExpenseAction, exportExpensesCsvAction } from '@/modules/finance/actions';
import type {
  ExpenseCategoryItem,
  ExpenseListItem,
  MarketingCampaignItem,
} from '@/modules/finance/types';
import { CreateExpenseDialog } from './create-expense-dialog';
import { Download, Search, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ExpensesTableProps {
  items: ExpenseListItem[];
  totalCount: number;
  totalSumFormatted: string;
  categories: ExpenseCategoryItem[];
  campaigns: MarketingCampaignItem[];
  selectedCategory?: string;
  searchQuery?: string;
}

export function ExpensesTable({
  items,
  totalCount,
  totalSumFormatted,
  categories,
  campaigns,
  selectedCategory,
  searchQuery,
}: ExpensesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchQuery ?? '');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const url = new URL(window.location.href);
      if (search.trim()) {
        url.searchParams.set('search', search.trim());
      } else {
        url.searchParams.delete('search');
      }
      router.push(url.pathname + url.search);
    });
  };

  const handleCategoryFilter = (catId: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      if (catId) {
        url.searchParams.set('categoryId', catId);
      } else {
        url.searchParams.delete('categoryId');
      }
      router.push(url.pathname + url.search);
    });
  };

  const handleDelete = async (id: string, description: string) => {
    if (!confirm(`Are you sure you want to delete this expense record: "${description}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteExpenseAction(id);
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to delete expense');
        return;
      }
      toast.success('Expense record deleted');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportExpensesCsvAction({
        categoryId: selectedCategory,
        search: search.trim() ? search.trim() : undefined,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to export CSV');
        return;
      }

      const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `AUREN-Expenses-Export-${new Date().toISOString().split('T')[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Expenses CSV exported successfully');
    } catch {
      toast.error('Failed to export expenses');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-sm border border-line bg-raised p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <form onSubmit={handleSearch} className="relative max-w-xs flex-1">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder="Search vendor, desc, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-line bg-page pl-8 text-xs"
            />
          </form>

          <select
            value={selectedCategory ?? ''}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            disabled={isPending}
            className="h-9 rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-fg-muted">
            Showing <strong className="text-fg">{totalCount}</strong> entries ({totalSumFormatted}{' '}
            total)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="gap-1.5 border-line text-xs"
          >
            {isExporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>

          <CreateExpenseDialog categories={categories} campaigns={campaigns} />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-sm border border-line bg-raised">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-sunken/50 text-left text-fg-muted">
                <th className="w-24 px-4 py-2.5 font-medium tracking-wider uppercase">Date</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Category</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">
                  Vendor &amp; Description
                </th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Campaign</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Method</th>
                <th className="w-32 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Amount
                </th>
                <th className="w-16 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-fg-muted">
                    No expense entries found matching this criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-sunken/40">
                    <td className="px-4 py-2.5 font-mono whitespace-nowrap text-fg-muted">
                      {item.expenseDate}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-fg">{item.categoryName}</span>
                        {item.isCogs && (
                          <Badge tone="gold" className="px-1 py-0">
                            COGS
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-fg">{item.vendor}</div>
                      <div className="max-w-sm truncate text-fg-muted">{item.description}</div>
                      {item.reference && (
                        <span className="font-mono text-xs text-fg-muted">
                          Ref: {item.reference}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {item.campaignName ? <Badge tone="neutral">{item.campaignName}</Badge> : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted capitalize">
                      {item.paymentMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-fg">
                      {item.amountFormatted}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id, item.description)}
                        className="h-7 w-7 p-0 text-fg-muted hover:text-oxblood"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete expense</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
