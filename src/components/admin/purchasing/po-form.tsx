'use client';

import { Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormActions, FormSection } from '@/components/admin/form-section';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  createPurchaseOrder,
  searchVariants,
  updatePurchaseOrder,
} from '@/modules/purchasing/actions';

export interface PoFormLine {
  variantId: string;
  label: string;
  sku: string;
  quantityOrdered: string;
  unitCost: string;
}

export interface PoFormValues {
  id: string;
  poNumber: string;
  supplierId: string;
  expectedAt: string;
  notes: string;
  lines: PoFormLine[];
}

interface VariantHit {
  variantId: string;
  label: string;
  sku: string;
  onHand: number;
}

/** Create or edit a draft purchase order: supplier, dates and lines (variant, quantity, unit cost). */
export function PoForm({
  order,
  suppliers,
}: {
  order?: PoFormValues;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? '');
  const [expectedAt, setExpectedAt] = useState(order?.expectedAt ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<PoFormLine[]>(order?.lines ?? []);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VariantHit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearchError(null);
    startSearch(async () => {
      const result = await searchVariants({ q: query.trim() });
      if (result.ok) setHits(result.data);
      else setSearchError(failureMessage(result));
    });
  }

  function addLine(hit: VariantHit) {
    if (lines.some((line) => line.variantId === hit.variantId)) return;
    setLines((current) => [
      ...current,
      {
        variantId: hit.variantId,
        label: hit.label,
        sku: hit.sku,
        quantityOrdered: '',
        unitCost: '',
      },
    ]);
  }

  const patch = (variantId: string, change: Partial<PoFormLine>) =>
    setLines((current) =>
      current.map((line) => (line.variantId === variantId ? { ...line, ...change } : line)),
    );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const payload = {
      supplierId,
      ...(expectedAt ? { expectedAt } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lines: lines.map((line) => ({
        variantId: line.variantId,
        quantityOrdered: Number(line.quantityOrdered),
        unitCost: line.unitCost.trim(),
      })),
    };
    startTransition(async () => {
      const result = order
        ? await updatePurchaseOrder({ id: order.id, ...payload })
        : await createPurchaseOrder(payload);
      if (result.ok) {
        const id = order ? order.id : (result.data as { id: string }).id;
        toast.success(order ? 'Draft saved' : 'Purchase order created');
        router.push(`/admin/purchasing/${id}`);
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormSection title="Order" description="Who you are buying from and when you expect it.">
        <FormField label="Supplier" error={firstError(errors, 'supplierId')} required>
          {(control) => (
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
                <SelectValue placeholder="Choose a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Expected delivery" error={firstError(errors, 'expectedAt')}>
          {(control) => (
            <Input
              {...control}
              type="date"
              value={expectedAt}
              onChange={(event) => setExpectedAt(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Notes" hint="Printed on the order" error={firstError(errors, 'notes')}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title="Lines"
        description="Search a product or SKU, add the variants you are buying, then enter the quantity and the unit cost in taka."
      >
        <div role="search" aria-label="Find variants" className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <FormField label="Find a variant" className="flex-1">
              {(control) => (
                <Input
                  {...control}
                  type="search"
                  value={query}
                  maxLength={80}
                  placeholder="Product title or SKU"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runSearch(event);
                  }}
                />
              )}
            </FormField>
            <Button
              type="button"
              variant="secondary"
              loading={searching}
              onClick={runSearch}
              aria-label="Search variants"
            >
              <Icon icon={Search} size={18} />
            </Button>
          </div>
          {searchError ? (
            <p role="alert" className="type-small text-danger-text">
              {searchError}
            </p>
          ) : null}
          {hits ? (
            hits.length === 0 ? (
              <p role="status" className="type-admin text-fg-muted">
                No variants match.
              </p>
            ) : (
              <ul className="divide-y divide-line border border-line">
                {hits.map((hit) => {
                  const added = lines.some((line) => line.variantId === hit.variantId);
                  return (
                    <li
                      key={hit.variantId}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate type-admin text-fg">{hit.label}</span>
                        <span className="type-small text-fg-muted">
                          {hit.sku} · {hit.onHand} on hand
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={added}
                        onClick={() => addLine(hit)}
                        aria-label={`${added ? 'Already added' : 'Add'} ${hit.label}`}
                      >
                        <Icon icon={Plus} size={16} />
                        {added ? 'Added' : 'Add'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>

        {lines.length === 0 ? (
          <p className="type-admin text-fg-muted">No lines yet. Search above and add a variant.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <li
                key={line.variantId}
                className="grid gap-3 border border-line p-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_auto] sm:items-end"
              >
                <div className="min-w-0">
                  <p className="truncate type-admin font-medium text-fg">{line.label}</p>
                  <p className="type-small font-mono text-fg-muted">{line.sku}</p>
                </div>
                <FormField
                  label={`Quantity (${line.sku})`}
                  error={firstError(errors, `lines.${index}.quantityOrdered`)}
                >
                  {(control) => (
                    <Input
                      {...control}
                      inputMode="numeric"
                      value={line.quantityOrdered}
                      onChange={(event) =>
                        patch(line.variantId, { quantityOrdered: event.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  label={`Unit cost (${line.sku})`}
                  error={firstError(errors, `lines.${index}.unitCost`)}
                >
                  {(control) => (
                    <Input
                      {...control}
                      inputMode="decimal"
                      placeholder="1250.00"
                      value={line.unitCost}
                      onChange={(event) => patch(line.variantId, { unitCost: event.target.value })}
                    />
                  )}
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${line.label}`}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((entry) => entry.variantId !== line.variantId),
                    )
                  }
                >
                  <Icon icon={X} size={18} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {firstError(errors, 'lines') ? (
          <p role="alert" className="type-small text-danger-text">
            {firstError(errors, 'lines')}
          </p>
        ) : null}
      </FormSection>

      <p role="alert" className="min-h-5 type-small text-danger-text">
        {formError}
      </p>
      <FormActions>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {order ? 'Save draft' : 'Create purchase order'}
        </Button>
      </FormActions>
    </form>
  );
}
