'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { receiveGoods } from '@/modules/purchasing/actions';

interface OutstandingLine {
  id: string;
  label: string;
  sku: string;
  outstanding: number;
}

const newKey = () => `receive-${crypto.randomUUID()}`;

/**
 * Receive goods against an order, in full or in part: type what actually arrived per line. Stock
 * rises and the average cost of each variant is recalculated. A double click or a retry cannot
 * receive twice: the form carries one idempotency key per delivery.
 */
export function ReceiveForm({
  poId,
  poNumber,
  lines,
}: {
  poId: string;
  poNumber: string;
  lines: OutstandingLine[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(newKey);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const open = lines.filter((line) => line.outstanding > 0);

  function receiveAll() {
    setKey(newKey());
    setQuantities(Object.fromEntries(open.map((line) => [line.id, String(line.outstanding)])));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const entries = open
      .map((line) => ({ poItemId: line.id, quantity: Number(quantities[line.id] ?? '') }))
      .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0);
    if (entries.length === 0) {
      setFormError('Enter the quantity that arrived for at least one line.');
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof receiveGoods>>;
      try {
        result = await receiveGoods({
          poId,
          idempotencyKey: key,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: entries,
        });
      } catch {
        setFormError('Could not reach the server. Nothing was recorded; check and try again.');
        return;
      }
      if (result.ok) {
        const complete = result.data.status === 'received';
        toast.success(
          complete ? `${poNumber} fully received` : 'Goods received',
          'Stock and average cost are updated.',
        );
        setQuantities({});
        setNotes('');
        setKey(newKey());
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  if (open.length === 0) return null;

  return (
    <section aria-labelledby="receive-heading" className="border border-line bg-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="receive-heading" className="type-h3 text-fg">
            Receive goods
          </h2>
          <p className="mt-1 type-admin text-fg-muted">
            Enter what arrived. Leave a line empty if it did not come in this delivery.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={receiveAll}>
          Fill all outstanding
        </Button>
      </div>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <ul className="flex flex-col gap-3">
          {open.map((line) => (
            <li
              key={line.id}
              className="grid gap-3 border border-line p-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end"
            >
              <div className="min-w-0">
                <p className="truncate type-admin font-medium text-fg">{line.label}</p>
                <p className="type-small text-fg-muted">
                  <span className="font-mono">{line.sku}</span> · {line.outstanding} outstanding
                </p>
              </div>
              <FormField label={`Received now (${line.sku})`}>
                {(control) => (
                  <Input
                    {...control}
                    inputMode="numeric"
                    value={quantities[line.id] ?? ''}
                    placeholder="0"
                    onChange={(event) => {
                      // A different delivery is a different request: it gets its own key.
                      setKey(newKey());
                      setQuantities((current) => ({ ...current, [line.id]: event.target.value }));
                    }}
                  />
                )}
              </FormField>
            </li>
          ))}
        </ul>
        <FormField label="Delivery note" error={firstError(errors, 'notes')}>
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </FormField>
        {firstError(errors, 'lines') ? (
          <p role="alert" className="type-small text-danger-text">
            {firstError(errors, 'lines')}
          </p>
        ) : null}
        <p role="alert" className="min-h-5 type-small text-danger-text">
          {formError}
        </p>
        <div>
          <Button type="submit" loading={pending}>
            Record delivery
          </Button>
        </div>
      </form>
    </section>
  );
}
