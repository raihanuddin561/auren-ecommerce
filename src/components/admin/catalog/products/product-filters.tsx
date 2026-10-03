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
import { PRODUCT_SORT_LABELS, productListHref, type ProductListQuery } from './list-params';
import { STATUS_LABEL } from './product-status';

const ALL = '__all';

interface ProductFiltersProps {
  query: ProductListQuery;
  categories: Array<{ id: string; label: string }>;
}

/** Search and filters. Every change is a navigation, so the URL always describes the view. */
export function ProductFilters({ query, categories }: ProductFiltersProps) {
  const router = useRouter();
  const [text, setText] = useState(query.q);
  const go = (next: Partial<ProductListQuery>) =>
    router.push(productListHref({ ...query, page: 1, ...next }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    go({ q: text.trim() });
  }

  return (
    <form
      role="search"
      aria-label="Filter products"
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]"
    >
      <FormField label="Search" hint="Title, slug or SKU">
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
            <Button type="submit" variant="secondary" size="icon" aria-label="Search products">
              <Icon icon={Search} size={18} />
            </Button>
          </div>
        )}
      </FormField>
      <FormField label="Status">
        {(control) => (
          <Select
            value={query.status ?? ALL}
            onValueChange={(value) =>
              go({ status: value === ALL ? undefined : (value as ProductListQuery['status']) })
            }
          >
            <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(['draft', 'active', 'archived'] as const).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
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
      <FormField label="Sort by">
        {(control) => (
          <Select
            value={query.sort}
            onValueChange={(value) => go({ sort: value as ProductListQuery['sort'] })}
          >
            <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRODUCT_SORT_LABELS) as Array<keyof typeof PRODUCT_SORT_LABELS>).map(
                (sort) => (
                  <SelectItem key={sort} value={sort}>
                    {PRODUCT_SORT_LABELS[sort]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        )}
      </FormField>
    </form>
  );
}
