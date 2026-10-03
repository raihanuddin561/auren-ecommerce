import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps {
  /** Id of the heading, so the section can be labelled by it. */
  id: string;
  eyebrow: string;
  title: string;
  description?: string | null;
  /** A link or button on the far side, such as "Shop all". */
  action?: ReactNode;
  className?: string;
}

/** Eyebrow, serif h2 and an optional action. Always an h2: the page has one h1, in the hero. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        'mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="max-w-2xl">
        <p className="type-eyebrow text-accent-text">{eyebrow}</p>
        <h2 id={id} className="mt-3 type-h1 text-fg">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 line-clamp-3 type-body text-pretty text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
