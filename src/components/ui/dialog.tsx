'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-ink/55',
        'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  );
}

export function CloseButton({
  className,
  label = 'Close',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <DialogPrimitive.Close
      aria-label={label}
      className={cn(
        'absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-sm text-fg transition-auren-fast hover:bg-fg/8',
        className,
      )}
    >
      <Icon icon={X} />
    </DialogPrimitive.Close>
  );
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Hide the corner close button when the dialog supplies its own actions. */
  hideClose?: boolean;
}

/** Centered modal. A DialogTitle is required for assistive tech (hide it with sr-only if needed). */
export function DialogContent({ className, children, hideClose, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-sm border border-line bg-raised p-6 text-fg shadow-float md:p-8',
          'max-h-[calc(100dvh-2.5rem)] overflow-y-auto',
          'data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : <CloseButton />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('type-h2 text-fg', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('type-body text-fg-muted', className)} {...props} />
  );
}
