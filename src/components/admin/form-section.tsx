import { Check, CircleDot, TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** A titled group of fields: explanation on the left, controls on the right (stacked on mobile). */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('grid gap-6 border border-line bg-raised p-5 md:grid-cols-3 md:p-6', className)}
    >
      <div>
        <h2 id={headingId} className="type-h3 text-fg">
          {title}
        </h2>
        {description ? <p className="mt-1 type-admin text-fg-muted">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-5 md:col-span-2">{children}</div>
    </section>
  );
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const statusCopy: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes',
  saving: 'Saving',
  error: 'Could not save. Your changes are kept on this page.',
};

/** Status line for forms that autosave drafts, shown beside the form actions. */
export function SaveStatusLine({ status }: { status: SaveStatus }) {
  const glyph = status === 'saved' ? Check : status === 'error' ? TriangleAlert : CircleDot;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 type-small',
        status === 'error' ? 'text-danger-text' : 'text-fg-muted',
      )}
    >
      <Icon icon={glyph} size={14} />
      {statusCopy[status]}
    </p>
  );
}

/** Sticky action bar at the bottom of long forms. */
export function FormActions({ children, status }: { children: ReactNode; status?: SaveStatus }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page px-4 py-4 md:-mx-8 md:px-8">
      {status ? <SaveStatusLine status={status} /> : <span />}
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
