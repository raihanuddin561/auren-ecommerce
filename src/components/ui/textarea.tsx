import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { fieldControlClasses } from './input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, invalid, rows = 4, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(fieldControlClasses, 'min-h-28 resize-y py-3 type-body', className)}
      {...props}
    />
  );
}
