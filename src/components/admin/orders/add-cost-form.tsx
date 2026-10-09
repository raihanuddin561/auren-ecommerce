'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { addOrderCostAction } from '@/modules/orders/fulfilment-actions';

/** Adds a cost nothing records automatically (a gift wrap, a tip to the rider). It is audited. */
export function AddCostForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setError(null);
    startTransition(async () => {
      try {
        const result = await addOrderCostAction({
          orderId,
          amount: amount.trim(),
          note: note.trim(),
        });
        if (result.ok) {
          toast.success('Cost added');
          setAmount('');
          setNote('');
          setOpen(false);
          router.refresh();
        } else {
          setErrors(fieldErrorsOf(result));
          setError(failureMessage(result));
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  if (!open) {
    return (
      <Button className="mt-4" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Add a cost
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-col gap-3 border-t border-line pt-4"
      noValidate
    >
      <FormField label="Amount (BDT)" required error={firstError(errors, 'amount')}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={amount}
            maxLength={12}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="What was it for" required error={firstError(errors, 'note')}>
        {(control) => (
          <Input
            {...control}
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </FormField>
      <p role="alert" className="min-h-5 type-small text-danger-text">
        {error}
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Add cost
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
