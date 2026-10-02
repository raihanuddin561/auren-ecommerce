import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Placeholder block. Size it to match the final content so nothing shifts when data arrives. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-skeleton rounded-xs bg-skeleton', className)}
      {...props}
    />
  );
}

interface SkeletonRegionProps extends ComponentProps<'div'> {
  /** What is loading, announced to assistive tech. */
  label: string;
}

/** Wraps a group of skeletons in a busy live region. */
export function SkeletonRegion({ label, className, children, ...props }: SkeletonRegionProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className} {...props}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Lines of text, last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
