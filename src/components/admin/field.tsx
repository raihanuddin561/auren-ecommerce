import type { InputHTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Labelled text input used by the staff sign-in and security screens. */
export function Field({ label, hint, error, required, disabled, ...props }: FieldProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} disabled={disabled}>
      {(control) => (
        <Input
          required={required}
          {...props}
          {...control}
          aria-describedby={
            [props['aria-describedby'], control['aria-describedby']].filter(Boolean).join(' ') ||
            undefined
          }
        />
      )}
    </FormField>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <Button type="submit" loading={pending} size="lg" fullWidth>
      {pending ? 'One moment' : children}
    </Button>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <p role="alert" className="min-h-5 type-small text-danger-text">
      {message}
    </p>
  );
}
