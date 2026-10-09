'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Badge } from '@/components/ui/badge';
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
import { toast } from '@/components/ui/toast';
import { confirmStepUp } from '@/modules/identity/actions';
import { previewCostBasis, setCostBasis } from '@/modules/inventory/actions';
import { SET_COST_STEP_UP } from '@/modules/inventory/schemas';

export interface SetCostTarget {
  variantId: string;
  productId: string;
  productTitle: string;
  title: string;
  /** The variant currency: costs are typed and shown in it. */
  currency: string;
}

type Scope = 'variant' | 'product';

interface PreviewRow {
  variantId: string;
  label: string;
  sku: string;
  onHand: number;
  hasCost: boolean;
}

/**
 * Gives a variant that has stock but no cost a cost basis, or does the same for every variant of its
 * product at once (owners think in products, not sizes). Existing costs are never changed here.
 */
export function SetCostDialog({
  target,
  onClose,
}: {
  target: SetCostTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? <SetCostForm key={target.variantId} target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SetCostForm({ target, onClose }: { target: SetCostTarget; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>('variant');
  const [cost, setCost] = useState('');
  const [password, setPassword] = useState('');
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (scope !== 'product' || preview !== null) return;
    let cancelled = false;
    previewCostBasis({ productId: target.productId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setPreview(result.data);
        else setPreviewFailed(true);
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, preview, target.productId]);

  const missing = preview?.filter((row) => !row.hasCost) ?? [];
  const keeping = preview?.filter((row) => row.hasCost) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      if (needsStepUp && password) {
        const confirmed = await confirmStepUp({
          method: 'password',
          purpose: SET_COST_STEP_UP,
          password,
        });
        if (!confirmed.ok) {
          setFormError(failureMessage(confirmed));
          return;
        }
        setPassword('');
      }
      const result = await setCostBasis({
        scope:
          scope === 'variant'
            ? { kind: 'variant', variantId: target.variantId }
            : { kind: 'product', productId: target.productId },
        unitCost: cost.trim(),
      });
      if (result.ok) {
        const { updated, skipped } = result.data;
        toast.success(
          updated === 1 ? 'Cost set on 1 variant' : `Cost set on ${updated} variants`,
          skipped > 0 ? `${skipped} already had a cost and were left as they are.` : undefined,
        );
        onClose();
        router.refresh();
        return;
      }
      if (result.error.code === 'STEP_UP_REQUIRED') {
        setNeedsStepUp(true);
        setFormError('Confirm your password to set a cost.');
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Set cost</DialogTitle>
        <DialogDescription>
          {target.title} has no cost yet, so customers cannot order it. Enter what one unit cost
          you, in {target.currency}. This only fills a missing cost: an existing cost changes
          through purchase receipts.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Where to set the cost</legend>
        {(
          [
            ['variant', 'This variant only'],
            ['product', 'All variants of this product'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={scope === value ? 'primary' : 'secondary'}
            aria-pressed={scope === value}
            onClick={() => {
              setScope(value);
              setPreviewFailed(false);
            }}
          >
            {label}
          </Button>
        ))}
      </fieldset>

      <FormField
        label={`Unit cost (${target.currency})`}
        hint="What one unit cost you, including freight and duty. For example 1250 or 1250.50."
        error={firstError(errors, 'unitCost')}
        required
      >
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={cost}
            maxLength={13}
            onChange={(event) => setCost(event.target.value)}
            autoFocus
          />
        )}
      </FormField>

      {scope === 'product' ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <h3 className="type-small font-medium text-fg">Preview for {target.productTitle}</h3>
          {previewFailed ? (
            <p className="type-small text-danger-text">The variants could not be loaded.</p>
          ) : preview === null ? (
            <p className="type-small text-fg-muted">Loading variants</p>
          ) : (
            <>
              <p className="type-small text-fg-muted">
                {missing.length} {missing.length === 1 ? 'variant gets' : 'variants get'}
                {cost.trim() ? ` a cost of ${cost.trim()} ${target.currency}` : ' this cost'}
                {keeping.length > 0
                  ? `; ${keeping.length} already ${keeping.length === 1 ? 'has' : 'have'} a cost and stay as they are.`
                  : '.'}
              </p>
              <ul className="max-h-40 divide-y divide-line overflow-y-auto border border-line type-small">
                {preview.map((row) => (
                  <li
                    key={row.variantId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span>
                      {row.label}
                      <span className="ml-2 font-mono text-fg-muted">{row.sku}</span>
                    </span>
                    {row.hasCost ? (
                      <Badge tone="outline">Keeps its cost</Badge>
                    ) : (
                      <Badge tone="warning">Gets this cost</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {needsStepUp ? (
        <FormField label="Your password" hint="Setting a cost needs a fresh confirmation." required>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoFocus
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
        <Button type="submit" loading={pending} disabled={scope === 'product' && preview === null}>
          Set cost
        </Button>
      </DialogFooter>
    </form>
  );
}
