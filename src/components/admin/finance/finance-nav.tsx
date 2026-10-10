'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { BarChart3, Receipt, FolderTree, Megaphone, Repeat, TrendingUp } from 'lucide-react';

interface TabItem {
  label: string;
  href: string;
  icon: typeof BarChart3;
}

const TABS: TabItem[] = [
  { label: 'P&L Statement', href: '/admin/finance', icon: BarChart3 },
  { label: 'Expenses Log', href: '/admin/finance/expenses', icon: Receipt },
  { label: 'Categories', href: '/admin/finance/categories', icon: FolderTree },
  { label: 'Marketing Campaigns', href: '/admin/finance/campaigns', icon: Megaphone },
  { label: 'Recurring OpEx', href: '/admin/finance/recurring', icon: Repeat },
  { label: 'Product Profitability', href: '/admin/finance/profitability', icon: TrendingUp },
];

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto border-b border-line pb-px"
      aria-label="Finance Navigation"
    >
      {TABS.map((tab) => {
        const isActive =
          tab.href === '/admin/finance'
            ? pathname === '/admin/finance'
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-gold font-semibold text-fg'
                : 'border-transparent text-fg-muted hover:border-line hover:text-fg',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
