'use client';

import { Toaster as Sonner } from 'sonner';

/**
 * Toast host, mounted once in the root layout. Raise toasts with `toast` from `./toast`.
 * Sonner provides the polite live region, swipe to dismiss and pause on hover/focus.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      visibleToasts={3}
      duration={5000}
      offset={{ bottom: 24, right: 24 }}
      mobileOffset={{ bottom: 16, left: 16, right: 16 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-sm border border-line bg-raised p-4 text-fg shadow-float',
          title: 'type-small font-medium text-fg',
          description: 'type-small text-fg-muted',
          actionButton:
            'ml-auto min-h-11 shrink-0 px-3 type-eyebrow text-fg underline decoration-gold underline-offset-4',
          cancelButton: 'min-h-11 shrink-0 px-3 type-eyebrow text-fg-muted',
          closeButton:
            'absolute top-1 right-1! left-auto! inline-flex size-8 items-center justify-center border-0 bg-transparent text-fg-muted hover:text-fg',
          success: 'border-l-2 border-l-success',
          error: 'border-l-2 border-l-danger',
          warning: 'border-l-2 border-l-warning',
        },
      }}
    />
  );
}
