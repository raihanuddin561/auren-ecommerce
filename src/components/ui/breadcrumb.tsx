'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';
import { useTranslation } from '@/lib/i18n/context';
import { translateCategory, translateProductTitle } from '@/lib/i18n/catalog-translator';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/** Trail of ancestors ending in the current page (aria-current). Collapses long labels. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const { locale, isBn, translateNav } = useTranslation();

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 type-small text-fg-muted">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const displayLabel = isBn
            ? current
              ? translateProductTitle(item.label, locale)
              : translateCategory(item.label, locale) || translateNav(item.label)
            : item.label;

          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="flex min-h-6 items-center">
                {current || !item.href ? (
                  <span
                    aria-current={current ? 'page' : undefined}
                    className={cn('max-w-56 truncate', current && 'text-fg')}
                  >
                    {displayLabel}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="max-w-56 truncate underline-offset-4 transition-auren-fast hover:text-fg hover:underline"
                  >
                    {displayLabel}
                  </Link>
                )}
              </li>
              {current ? null : (
                <li aria-hidden="true" className="flex items-center">
                  <Icon icon={ChevronRight} size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
