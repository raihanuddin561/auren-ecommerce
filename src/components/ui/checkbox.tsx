'use client';

import { Check, Minus } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

interface CheckboxProps extends Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'children'> {
  /** Visible label. The whole row is clickable (44px target). */
  label?: ReactNode;
  description?: string;
  invalid?: boolean;
}

export function Checkbox({ className, label, description, invalid, id, ...props }: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-1.5', className)}>
      <CheckboxPrimitive.Root
        id={controlId}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptionId}
        className={cn(
          'peer touch-target mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-xs border border-line-strong bg-raised text-page transition-auren-fast',
          'hover:border-fg',
          'data-[state=checked]:border-fg data-[state=checked]:bg-fg data-[state=indeterminate]:border-fg data-[state=indeterminate]:bg-fg',
          'aria-invalid:border-danger',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          {props.checked === 'indeterminate' ? (
            <Icon icon={Minus} size={14} />
          ) : (
            <Icon icon={Check} size={14} />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? (
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
      ) : null}
    </div>
  );
}
