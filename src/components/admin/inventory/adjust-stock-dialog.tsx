'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { confirmStepUp } from '@/modules/identity/actions';
import { adjustStock } from '@/modules/inventory/actions';
import {
  ADJUSTMENT_REASONS,
  REASON_LABELS,
  WRITE_OFF_STEP_UP,
  isWriteOffReason,
  type AdjustmentReason,
} from '@/modules/inventory/schemas';

export interface AdjustTarget {
  variantId: string;
  title: string;
  onHand: number;
  reserved: number;
}

type Mode = 'delta' | 'set';

/** Staff correction of one variant: change by a number or set the counted quantity, with a reason. */
export function AdjustStockDialog({
  target,
  onClose,
}: {
  target: AdjustTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? <AdjustForm key={target.variantId} target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ target, onClose }: { target: AdjustTarget; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('delta');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('count_correction');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const number = amount.trim() === '' ? null : Number(amount);
  const valid = number !== null && /^-?\d+$/.test(amount.trim());
  const resulting = !valid ? null : mode === 'set' ? number : target.onHand + number;
  const writeOff =
    isWriteOffReason(reason) || mode === 'set' || (valid && number !== null && number < 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    if (!valid) {
      setErrors({ change: ['Enter a whole number.'] });
      return;
    }
    startTransition(async () => {
      if ((needsStepUp || writeOff) && password) {
        const confirmed = await confirmStepUp({
          method: 'password',
          purpose: WRITE_OFF_STEP_UP,
          password,
        });
        if (!confirmed.ok) {
          setFormError(failureMessage(confirmed));
          return;
        }
        setPassword('');
      }
      const result = await adjustStock({
        variantId: target.variantId,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
        change: mode === 'delta' ? { mode, delta: number } : { mode, counted: number },
      });
      if (result.ok) {
        toast.success('Stock updated', `${result.data.onHand} on hand now.`);
        onClose();
        router.refresh();
        return;
      }
      if (result.error.code === 'STEP_UP_REQUIRED') {
        setNeedsStepUp(true);
        setFormError('Confirm your password to remove stock.');
        return;
      }
      if (result.error.code === 'APPROVAL_REQUIRED') {
        setFormError(
          'This write-down is above the approval limit. A second person must approve it first.',
        );
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          {target.title}. {target.onHand} on hand, {target.reserved} reserved for customers.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="flex gap-2">
        <legend className="sr-only">How to enter the change</legend>
        {(
          [
            ['delta', 'Change by'],
            ['set', 'Set count to'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={mode === value ? 'primary' : 'secondary'}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </fieldset>

      <FormField
        label={mode === 'delta' ? 'Units to add or remove' : 'Counted quantity'}
        hint={
          mode === 'delta'
            ? 'Use a minus sign to remove, for example -2.'
            : 'The quantity you counted on the shelf.'
        }
        error={firstError(errors, 'change')}
        required
      >
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        )}
      </FormField>
      {resulting !== null ? (
        <p role="status" className="type-admin text-fg-muted">
          On hand after this: <strong className="text-fg tabular-nums">{resulting}</strong>
        </p>
      ) : null}

      <FormField label="Reason" required>
        {(control) => (
          <Select value={reason} onValueChange={(value) => setReason(value as AdjustmentReason)}>
            <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADJUSTMENT_REASONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {REASON_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField
        label="Note"
        hint={
          reason === 'write_off' || reason === 'other' ? 'Required for this reason.' : 'Optional'
        }
        error={firstError(errors, 'note')}
        required={reason === 'write_off' || reason === 'other'}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </FormField>

      {needsStepUp || writeOff ? (
        <FormField
          label="Your password"
          hint="Removing stock needs a fresh confirmation."
          required={needsStepUp}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </FormField>
      ) : null}

      <p role="alert" className="min-h-5 type-small text-danger-text">
        {formError}
      </p>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Save adjustment
        </Button>
      </DialogFooter>
    </form>
  );
}
