import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-xs px-2 py-1 type-eyebrow whitespace-nowrap leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-fg/10 text-fg',
        outline: 'border border-line-strong bg-transparent text-fg',
        ink: 'bg-fg text-page',
        /** Small accent only (never a large fill). */
        gold: 'border border-gold bg-transparent text-accent-text',
        /** Limited drops and sale. */
        oxblood: 'bg-oxblood text-paper',
        success: 'bg-success text-paper',
        warning: 'border border-warning bg-transparent text-warning-text',
        danger: 'bg-danger text-paper',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
