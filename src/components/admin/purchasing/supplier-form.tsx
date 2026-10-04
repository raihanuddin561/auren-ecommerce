'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormActions, FormSection } from '@/components/admin/form-section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { createSupplier, updateSupplier } from '@/modules/purchasing/actions';

export interface SupplierFormValues {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
}

export function SupplierForm({
  supplier,
  canWrite,
}: {
  supplier?: SupplierFormValues;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [values, setValues] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    paymentTerms: supplier?.paymentTerms ?? '',
    notes: supplier?.notes ?? '',
  });
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = supplier
        ? await updateSupplier({ id: supplier.id, ...values, isActive })
        : await createSupplier(values);
      if (result.ok) {
        toast.success(supplier ? 'Supplier saved' : 'Supplier created');
        router.push('/admin/suppliers');
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  const text = (key: keyof typeof values, label: string, hint?: string, type = 'text') => (
    <FormField label={label} hint={hint} error={firstError(errors, key)} required={key === 'name'}>
      {(control) => (
        <Input
          {...control}
          type={type}
          value={values[key]}
          maxLength={key === 'address' ? 300 : 160}
          disabled={!canWrite}
          onChange={(event) => set(key)(event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormSection title="Supplier" description="Who you buy from and how to reach them.">
        {text('name', 'Name')}
        {text('contactName', 'Contact person')}
        <div className="grid gap-5 sm:grid-cols-2">
          {text('phone', 'Phone')}
          {text('email', 'Email', undefined, 'email')}
        </div>
        {text('address', 'Address')}
      </FormSection>
      <FormSection
        title="Terms"
        description="Printed on purchase orders and kept for your records."
      >
        {text('paymentTerms', 'Payment terms', 'For example 30 days after delivery')}
        <FormField label="Notes" error={firstError(errors, 'notes')}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={1000}
              value={values.notes}
              disabled={!canWrite}
              onChange={(event) => set('notes')(event.target.value)}
            />
          )}
        </FormField>
        {supplier ? (
          <div className="flex flex-col gap-1 border border-line p-4">
            <Switch
              label="Active"
              checked={isActive}
              disabled={!canWrite}
              onCheckedChange={setIsActive}
            />
            <p className="type-admin text-fg-muted">
              Inactive suppliers keep their history but cannot take new purchase orders.
            </p>
          </div>
        ) : null}
      </FormSection>
      <p role="alert" className="min-h-5 type-small text-danger-text">
        {formError}
      </p>
      {canWrite ? (
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/suppliers')}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {supplier ? 'Save supplier' : 'Create supplier'}
          </Button>
        </FormActions>
      ) : null}
    </form>
  );
}
