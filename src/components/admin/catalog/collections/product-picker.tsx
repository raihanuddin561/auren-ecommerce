'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { addCollectionProducts, searchProductsForPicker } from '@/modules/catalog/actions';
import {
  isSelected,
  MAX_PRODUCTS_PER_ADD,
  toggleSelected,
  withoutMembers,
  type PickerProduct,
} from './picker-state';
import { ProductStatusBadge, ProductThumb } from './product-thumb';

interface ProductPickerProps {
  collectionId: string;
  /** Products already in the collection; they are left out of the results. */
  memberIds: string[];
  disabled: boolean;
}

type SearchResult =
  | { key: string; state: 'ready'; items: PickerProduct[] }
  | { key: string; state: 'error'; message: string };

/** Search products and add several to a manual collection in one go. */
export function ProductPicker({ collectionId, memberIds, disabled }: ProductPickerProps) {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PickerProduct[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [adding, setAdding] = useState(false);

  const term = query.trim();
  const key = term === '' ? null : `${term}|${memberIds.join(',')}`;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let response: Awaited<ReturnType<typeof searchProductsForPicker>>;
      try {
        response = await searchProductsForPicker({ q: term, excludeIds: memberIds });
      } catch {
        if (!cancelled)
          setResult({ key, state: 'error', message: 'The search could not be loaded.' });
        return;
      }
      if (cancelled) return;
      setResult(
        response.ok
          ? { key, state: 'ready', items: response.data }
          : { key, state: 'error', message: failureMessage(response) ?? 'The search failed.' },
      );
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // The key already holds the term and the member ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = result && key && result.key === key ? result : null;
  const chosen = withoutMembers(selected, memberIds);

  async function add() {
    if (chosen.length === 0) return;
    setAdding(true);
    const response = await addCollectionProducts({
      collectionId,
      productIds: chosen.map((item) => item.id),
    });
    setAdding(false);
    if (!response.ok) {
      toast.error(failureMessage(response) ?? 'The products could not be added.');
      return;
    }
    toast.success(
      response.data.added === 1 ? '1 product added' : `${response.data.added} products added`,
    );
    setSelected([]);
    router.refresh();
  }

  return (
    <section aria-label="Add products" className="flex flex-col gap-4 border border-line p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Add products</Label>
        <div className="relative">
          <Icon
            icon={Search}
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
          />
          <Input
            id={inputId}
            type="search"
            value={query}
            disabled={disabled}
            placeholder="Search by product name"
            autoComplete="off"
            maxLength={80}
            className="pl-11"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {!key ? (
          <p className="type-small text-fg-muted">Type a name to find products to add.</p>
        ) : !fresh ? (
          <>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
            <span className="sr-only">Searching</span>
          </>
        ) : fresh.state === 'error' ? (
          <p className="type-admin text-danger-text">{fresh.message}</p>
        ) : fresh.items.length === 0 ? (
          <p className="type-admin text-fg-muted">
            No products match that search, or they are already in this collection.
          </p>
        ) : null}
      </div>

      {fresh?.state === 'ready' && fresh.items.length > 0 ? (
        <ul className="flex max-h-96 flex-col overflow-y-auto border border-line">
          {fresh.items.map((item) => (
            <li key={item.id} className="border-b border-line px-3 last:border-b-0">
              <Checkbox
                checked={isSelected(selected, item.id)}
                disabled={disabled}
                onCheckedChange={() => setSelected((current) => toggleSelected(current, item))}
                label={
                  <span className="flex items-center gap-3">
                    <ProductThumb url={item.imageUrl} alt="" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <ProductStatusBadge status={item.status} />
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          loading={adding}
          disabled={disabled || chosen.length === 0}
          onClick={add}
        >
          {chosen.length === 0
            ? 'Add products'
            : chosen.length === 1
              ? 'Add 1 product'
              : `Add ${chosen.length} products`}
        </Button>
        {chosen.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        ) : null}
        {chosen.length >= MAX_PRODUCTS_PER_ADD ? (
          <p className="type-small text-fg-muted">
            You can add up to {MAX_PRODUCTS_PER_ADD} products at a time.
          </p>
        ) : null}
      </div>
    </section>
  );
}
