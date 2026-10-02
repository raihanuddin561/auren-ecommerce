'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  label: ReactNode;
}

export function Switch({ className, label, id, ...props }: SwitchProps) {
  const generated = useId();
  const controlId = id ?? generated;

  return (
    <div className={cn('flex min-h-11 items-center gap-3', className)}>
      <SwitchPrimitive.Root
        id={controlId}
        className={cn(
          'peer touch-target relative inline-flex h-6 w-11 shrink-0 items-center rounded-sm border border-line-strong bg-sunken transition-auren-fast',
          'data-[state=checked]:border-fg data-[state=checked]:bg-fg',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-xs bg-fg transition-transform duration-(--dur-base) ease-auren data-[state=checked]:translate-x-6 data-[state=checked]:bg-page" />
      </SwitchPrimitive.Root>
      <label
        htmlFor={controlId}
        className="cursor-pointer type-body text-fg peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
      >
        {label}
      </label>
    </div>
  );
}
