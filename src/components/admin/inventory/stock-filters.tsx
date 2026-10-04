'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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
import {
  STOCK_STATUS_LABELS,
  stockListHref,
  type StockQuery,
  type StockStatusFilter,
} from './list-params';

const ALL = '__all';

/** Search and filters; every change is a navigation so the URL always describes the view. */
export function StockFilters({
  query,
  categories,
}: {
  query: StockQuery;
  categories: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [text, setText] = useState(query.q);
  const go = (next: Partial<StockQuery>) =>
    router.push(stockListHref({ ...query, page: 1, ...next }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    go({ q: text.trim() });
  }

  return (
    <form
      role="search"
      aria-label="Filter stock levels"
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]"
    >
      <FormField label="Search" hint="Product title or SKU">
        {(control) => (
          <div className="flex gap-2">
            <Input
              {...control}
              type="search"
              name="q"
              value={text}
              maxLength={80}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" variant="secondary" size="icon" aria-label="Search stock">
              <Icon icon={Search} size={18} />
            </Button>
          </div>
        )}
      </FormField>
      <FormField label="Stock">
        {(control) => (
          <Select
            value={query.status}
            onValueChange={(value) => go({ status: value as StockStatusFilter })}
          >
            <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STOCK_STATUS_LABELS) as StockStatusFilter[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STOCK_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Category">
        {(control) => (
          <Select
            value={query.category ?? ALL}
            onValueChange={(value) => go({ category: value === ALL ? undefined : value })}
          >
            <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
    </form>
  );
}
