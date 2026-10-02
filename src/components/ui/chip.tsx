'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

interface FilterChipProps extends Omit<ComponentProps<'button'>, 'aria-pressed'> {
  selected?: boolean;
}

/** The only pill in the system: a toggleable filter chip. */
export function FilterChip({
  className,
  selected = false,
  type = 'button',
  ...props
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'touch-target inline-flex min-h-10 items-center gap-2 rounded-full border px-4 type-small transition-auren-fast',
        selected
          ? 'border-fg bg-fg text-page'
          : 'border-line-strong bg-transparent text-fg hover:border-fg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
