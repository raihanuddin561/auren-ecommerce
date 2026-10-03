'use client';

import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NONE } from './select-value';

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  /** Label of the "no value" choice. Leave out when a value is always required. */
  noneLabel?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  hideLabel?: boolean;
  className?: string;
}

/** A labelled Select whose empty choice travels as a sentinel, never as an empty item value. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  noneLabel,
  hint,
  error,
  required,
  hideLabel,
  className,
}: SelectFieldProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={className}
    >
      {(control) => (
        <Select value={value} onValueChange={onChange} disabled={control.disabled}>
          <SelectTrigger
            id={control.id}
            aria-describedby={control['aria-describedby']}
            invalid={Boolean(control['aria-invalid'])}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {noneLabel ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
