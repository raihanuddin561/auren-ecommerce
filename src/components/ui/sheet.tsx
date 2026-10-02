'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { CloseButton, DialogOverlay } from './dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva('fixed z-50 flex flex-col bg-raised text-fg shadow-float outline-none', {
  variants: {
    side: {
      right:
        'inset-y-0 right-0 h-dvh w-[min(100%,28rem)] border-l border-line data-[state=open]:animate-drawer-in-right data-[state=closed]:animate-drawer-out-right',
      left: 'inset-y-0 left-0 h-dvh w-[min(100%,28rem)] border-r border-line data-[state=open]:animate-drawer-in-left data-[state=closed]:animate-drawer-out-left',
      bottom:
        'inset-x-0 bottom-0 max-h-[85dvh] border-t border-line data-[state=open]:animate-drawer-in-bottom data-[state=closed]:animate-drawer-out-bottom',
      /** Full-screen takeover for the mobile menu. */
      full: 'inset-0 h-dvh w-full data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
    },
  },
  defaultVariants: { side: 'right' },
});

interface SheetContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>, VariantProps<typeof sheetVariants> {
  hideClose?: boolean;
}

/** Drawer. Traps focus, closes on Escape, returns focus to the trigger. Needs a SheetTitle. */
export function SheetContent({
  className,
  side,
  children,
  hideClose,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {hideClose ? null : <CloseButton />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-line px-6 py-5 pr-16', className)}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-6', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-3 border-t border-line px-6 py-5', className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('type-h2 text-fg', className)} {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('type-small text-fg-muted', className)} {...props} />
  );
}
