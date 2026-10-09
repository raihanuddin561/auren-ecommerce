'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/components/ui/price';
import { deserialize, type SerializedMoney } from '@/lib/money';
import { searchOrderVariants } from '@/modules/orders/actions';
import { NativeSelect } from '@/components/storefront/checkout/native-select';

export interface LineDraft {
  /** Stable key for React. */
  key: string;
  /** The existing order line this row came from, if any. */
  itemId?: string;
  variantId: string;
  title: string;
  label: string;
  sku: string;
  quantity: string;
  price: SerializedMoney | null;
  available: number | null;
  /** Other variants of the same product, for the inline size or colour swap. */
  alternatives?: Array<{
    variantId: string;
    label: string;
    available: number;
    price: SerializedMoney;
  }>;
}

interface Hit {
  variantId: string;
  label: string;
  sku: string;
  available: number;
  price: SerializedMoney;
}

const money = (value: SerializedMoney) => formatPrice(deserialize(value));

/**
 * The lines of an order being typed or edited: change quantity, swap size or colour inline, remove,
 * and add from a search. Prices shown are the catalog's; the server prices the order again.
 */
export function LinesEditor({
  lines,
  onChange,
  error,
}: {
  lines: LineDraft[];
  onChange: (next: LineDraft[]) => void;
  error?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearchError(null);
    startSearch(async () => {
      try {
        const result = await searchOrderVariants({ q: query.trim() });
        if (result.ok) setHits(result.data);
        else setSearchError(failureMessage(result));
      } catch {
        setSearchError('The search failed. Please try again.');
      }
    });
  }

  const patch = (key: string, change: Partial<LineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));

  function add(hit: Hit) {
    if (lines.some((line) => line.variantId === hit.variantId)) return;
    onChange([
      ...lines,
      {
        key: `new-${hit.variantId}`,
        variantId: hit.variantId,
        title: hit.label,
        label: '',
        sku: hit.sku,
        quantity: '1',
        price: hit.price,
        available: hit.available,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 ? (
        <p className="type-admin text-fg-muted">No items yet. Search below to add one.</p>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {lines.map((line) => (
            <li key={line.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-48 flex-1">
                <div className="type-admin text-fg">{line.title}</div>
                <div className="type-small text-fg-muted">
                  {line.sku}
                  {line.price ? ` · ${money(line.price)}` : ''}
                  {line.available !== null ? ` · ${line.available} available` : ''}
                </div>
              </div>
              {line.alternatives && line.alternatives.length > 1 ? (
                <div className="w-44">
                  <NativeSelect
                    aria-label={`Size or colour for ${line.title}`}
                    className="h-10"
                    value={line.variantId}
                    onChange={(event) => {
                      const next = line.alternatives?.find(
                        (item) => item.variantId === event.target.value,
                      );
                      if (!next) return;
                      patch(line.key, {
                        variantId: next.variantId,
                        label: next.label,
                        price: next.price,
                        available: next.available,
                      });
                    }}
                  >
                    {line.alternatives.map((item) => (
                      <option
                        key={item.variantId}
                        value={item.variantId}
                        disabled={item.available <= 0 && item.variantId !== line.variantId}
                      >
                        {item.label}
                        {item.available <= 0 ? ' (sold out)' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : line.label ? (
                <span className="type-small text-fg-muted">{line.label}</span>
              ) : null}
              <label className="flex items-center gap-2 type-small text-fg-muted">
                Qty
                <Input
                  aria-label={`Quantity of ${line.title}`}
                  className="h-10 w-20"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) => patch(line.key, { quantity: event.target.value })}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${line.title}`}
                onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
              >
                <Icon icon={Trash2} size={18} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="type-small text-danger-text">
          {error}
        </p>
      ) : null}

      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 type-small text-fg-muted">
          Add an item by product name or SKU
          <Input
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary" loading={searching}>
          Search
        </Button>
      </form>
      {searchError ? (
        <p role="alert" className="type-small text-danger-text">
          {searchError}
        </p>
      ) : null}
      {hits ? (
        hits.length === 0 ? (
          <p className="type-small text-fg-muted">
            Nothing sellable matches. Only live variants with a cost can be ordered.
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-line overflow-y-auto border border-line">
            {hits.map((hit) => (
              <li key={hit.variantId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="type-admin text-fg">
                  {hit.label}
                  <span className="ml-2 type-small font-mono text-fg-muted">{hit.sku}</span>
                </span>
                <span className="flex items-center gap-3 type-small text-fg-muted">
                  {money(hit.price)} · {hit.available} available
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      hit.available <= 0 || lines.some((line) => line.variantId === hit.variantId)
                    }
                    onClick={() => add(hit)}
                  >
                    Add
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
