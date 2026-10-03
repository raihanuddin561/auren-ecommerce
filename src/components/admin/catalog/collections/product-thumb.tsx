import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

/** Small 4:5 product image for lists. Admin-only, so a plain image is enough. */
export function ProductThumb({
  url,
  alt,
  className,
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return (
      <span
        aria-hidden="true"
        className={cn('block aspect-[4/5] w-10 shrink-0 border border-line bg-sunken', className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an already optimised upload
    <img
      src={url}
      alt={alt}
      width={40}
      height={50}
      loading="lazy"
      className={cn('aspect-[4/5] w-10 shrink-0 border border-line object-cover', className)}
    />
  );
}

const STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'outline' }> = {
  active: { label: 'Active', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'outline' },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
