'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'font-sans font-medium uppercase tracking-button transition-auren-fast',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    'aria-busy:cursor-progress',
  ],
  {
    variants: {
      variant: {
        /** Ink fill, the one primary action per viewport. */
        primary: 'rounded-sm bg-fg text-page hover:bg-fg/85 active:bg-fg/75',
        /** Outline for secondary actions. */
        secondary:
          'rounded-sm border border-fg bg-transparent text-fg hover:bg-fg hover:text-page active:bg-fg/85 active:text-page',
        ghost: 'rounded-sm bg-transparent text-fg hover:bg-fg/8 active:bg-fg/12',
        /** Text link with a gold underline. */
        link: 'rounded-none bg-transparent p-0 text-fg normal-case tracking-normal underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2 touch-target',
        danger: 'rounded-sm bg-danger text-paper hover:bg-danger/90 active:bg-danger/80',
      },
      size: {
        sm: 'min-h-10 px-4 text-eyebrow',
        md: 'min-h-12 px-6 text-small',
        lg: 'min-h-14 px-8 text-small',
        icon: 'size-11 p-0',
        /** No box of its own: inline text links. */
        none: '',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a Next.js Link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and blocks repeat clicks while keeping the label for assistive tech. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = 'button',
  ref,
  onClick,
  ...props
}: ButtonProps) {
  const resolvedSize = size ?? (variant === 'link' ? 'none' : 'md');
  const classes = cn(buttonVariants({ variant, size: resolvedSize, fullWidth }), className);

  if (asChild) {
    const inert = disabled || loading;
    return (
      <Slot.Root
        ref={ref}
        className={classes}
        aria-disabled={inert || undefined}
        aria-busy={loading || undefined}
        onClick={inert ? (event: React.MouseEvent) => event.preventDefault() : onClick}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      // Loading keeps focus on the button but swallows clicks, so a form cannot submit twice.
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<ButtonProps, 'size' | 'children' | 'aria-label'> & {
  /** Icon-only controls must be named. */
  'aria-label': string;
  children: ButtonProps['children'];
};

/** Square 44px icon control. */
export function IconButton({ className, variant = 'ghost', ...props }: IconButtonProps) {
  return <Button variant={variant} size="icon" className={className} {...props} />;
}
