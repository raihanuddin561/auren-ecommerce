import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './label';

export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
  disabled: true | undefined;
}

interface FormFieldProps {
  label: string;
  /** Helper text shown under the control. */
  hint?: string;
  /** Validation message; announced to assistive tech when it appears. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/**
 * Label, control, hint and error wired together with the right ids. The control is rendered by
 * the caller so any primitive (Input, Textarea, Select trigger) can sit inside.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  disabled,
  hideLabel,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-fg-muted">
            {' '}
            (required)
          </span>
        ) : null}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
        disabled: disabled ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="type-small text-fg-muted">
          {hint}
        </p>
      ) : null}
      <p
        id={errorId}
        role="alert"
        className={cn('type-small text-danger-text', !error && 'sr-only')}
      >
        {error ?? ''}
      </p>
    </div>
  );
}
