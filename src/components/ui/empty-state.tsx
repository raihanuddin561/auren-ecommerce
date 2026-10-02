import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional icon element, for example `<Icon icon={PackageOpen} size={28} />`. */
  icon?: ReactNode;
  /** Primary and secondary actions. */
  action?: ReactNode;
  /** `error` announces the state to assistive tech immediately. */
  tone?: 'empty' | 'error';
  className?: string;
}

/** Calm placeholder for empty lists, no results and recoverable errors. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = 'empty',
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center gap-3 border border-line px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-fg-muted">{icon}</div> : null}
      <p className="type-h3 text-fg">{title}</p>
      {description ? <p className="max-w-md type-body text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
