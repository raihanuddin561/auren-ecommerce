'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { addLandedCost, removeLandedCost } from '@/modules/purchasing/actions';
import {
  ALLOCATION_LABELS,
  LANDED_COST_LABELS,
  LANDED_COST_TYPES,
  type LandedCostTypeValue,
} from '@/modules/purchasing/schemas';

interface CostRow {
  id: string;
  type: string;
  amount: string;
  method: 'by_quantity' | 'by_value';
  note: string | null;
}

/** Freight, duty and other costs, spread over the lines by quantity or by value. */
export function LandedCostsPanel({
  poId,
  costs,
  canAdd,
  canRemove,
}: {
  poId: string;
  costs: CostRow[];
  canAdd: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<LandedCostTypeValue>('freight');
  const [method, setMethod] = useState<'by_quantity' | 'by_value'>('by_value');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await addLandedCost({
        poId,
        type,
        amount: amount.trim(),
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (result.ok) {
        toast.success('Cost added');
        setAmount('');
        setNote('');
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof removeLandedCost>>;
      try {
        result = await removeLandedCost({ id });
      } catch {
        toast.error('Could not reach the server', 'Nothing was changed. Try again.');
        return;
      }
      if (result.ok) {
        toast.success('Cost removed');
        router.refresh();
      } else {
        toast.error('Could not remove the cost', failureMessage(result) ?? undefined);
      }
    });
  }

  return (
    <section aria-labelledby="landed-heading" className="border border-line bg-raised p-5">
      <h2 id="landed-heading" className="type-h3 text-fg">
        Landed costs
      </h2>
      <p className="mt-1 type-admin text-fg-muted">
        Freight, duty and fees become part of what each unit cost you. They are spread over the
        lines and feed the average cost when goods are received.
      </p>
      {costs.length === 0 ? (
        <p className="mt-4 type-admin text-fg-muted">No landed costs on this order.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border border-line">
          {costs.map((cost) => (
            <li key={cost.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 type-admin">
                <span className="font-medium text-fg">
                  {LANDED_COST_LABELS[cost.type as LandedCostTypeValue] ?? cost.type}
                </span>{' '}
                <span className="text-fg-muted">
                  {ALLOCATION_LABELS[cost.method].toLowerCase()}
                  {cost.note ? ` · ${cost.note}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="type-admin text-fg tabular-nums">{cost.amount}</span>
                {canRemove ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${LANDED_COST_LABELS[cost.type as LandedCostTypeValue] ?? cost.type} cost`}
                    disabled={pending}
                    onClick={() => remove(cost.id)}
                  >
                    <Icon icon={X} size={16} />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canAdd ? (
        <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-2" noValidate>
          <FormField label="Cost type">
            {(control) => (
              <Select value={type} onValueChange={(value) => setType(value as LandedCostTypeValue)}>
                <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANDED_COST_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LANDED_COST_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Spread">
            {(control) => (
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as 'by_quantity' | 'by_value')}
              >
                <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="by_value">
                    {ALLOCATION_LABELS.by_value} (cost of goods)
                  </SelectItem>
                  <SelectItem value="by_quantity">
                    {ALLOCATION_LABELS.by_quantity} (units)
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            label="Amount"
            hint="In taka, for example 1500"
            error={firstError(errors, 'amount')}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Note" error={firstError(errors, 'note')}>
            {(control) => (
              <Input
                {...control}
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
          <div className="sm:col-span-2">
            <p role="alert" className="min-h-5 type-small text-danger-text">
              {formError}
            </p>
            <Button type="submit" variant="secondary" loading={pending}>
              Add cost
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
