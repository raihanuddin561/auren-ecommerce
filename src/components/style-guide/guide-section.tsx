import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface GuideSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** One block of the style guide. `data-section` is the handle visual snapshots use. */
export function GuideSection({ id, title, description, children, className }: GuideSectionProps) {
  return (
    <section
      id={id}
      data-section={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-20 border-t border-line pt-10 pb-12', className)}
    >
      <h2 id={`${id}-title`} className="type-h2 font-sans font-medium text-fg">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-2xl type-admin text-fg-muted">{description}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

/** Labelled group inside a section (for example "Sizes" or "States"). */
export function GuideGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div>
      <p className="mb-4 type-eyebrow text-fg-muted">{label}</p>
      <div className={cn('flex flex-wrap items-start gap-4', className)}>{children}</div>
    </div>
  );
}

/** Caption under a specimen, naming the state it shows. */
export function Specimen({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div>{children}</div>
      <figcaption className="type-small text-fg-muted">{label}</figcaption>
    </figure>
  );
}
