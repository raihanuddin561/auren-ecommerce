import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';

/** Shared look for every text-like control (input, textarea, select trigger). */
export const fieldControlClasses = cn(
  'w-full rounded-sm border border-line-strong bg-raised px-4 text-fg transition-auren-fast',
  'placeholder:text-fg-muted',
  'hover:border-fg/60',
  'aria-invalid:border-danger aria-invalid:bg-raised',
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken disabled:text-fg-muted disabled:opacity-70',
  'read-only:bg-sunken',
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the control invalid for assistive tech and styling. */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, invalid, type = 'text', ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(fieldControlClasses, 'h-12 type-body', className)}
      {...props}
    />
  );
}
