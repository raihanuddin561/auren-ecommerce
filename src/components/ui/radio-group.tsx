'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function RadioGroup({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('grid gap-1', className)} {...props} />;
}

interface RadioItemProps extends Omit<ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> {
  label: ReactNode;
  description?: string;
}

export function RadioItem({ className, label, description, id, ...props }: RadioItemProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-1.5', className)}>
      <RadioGroupPrimitive.Item
        id={controlId}
        aria-describedby={descriptionId}
        className={cn(
          'peer touch-target mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised transition-auren-fast',
          'hover:border-fg data-[state=checked]:border-fg',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-fg" />
      </RadioGroupPrimitive.Item>
      <div className="flex flex-col">
        <label
          htmlFor={controlId}
          className="cursor-pointer type-body text-fg peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="type-small text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
