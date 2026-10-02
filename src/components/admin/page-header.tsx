import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary and secondary actions, right-aligned on wide screens. */
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  className?: string;
  /** Heading element. Only the real page title is an h1; specimens use a lower level. */
  titleAs?: 'h1' | 'h2' | 'h3';
}

/** Every admin screen starts with one h1 (sans, not the storefront serif). */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
  titleAs: Title = 'h1',
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb ? <Breadcrumb items={breadcrumb} className="mb-3" /> : null}
        <Title className="type-h2 font-sans font-medium text-fg">{title}</Title>
        {description ? (
          <div className="mt-1.5 max-w-2xl type-admin text-fg-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
