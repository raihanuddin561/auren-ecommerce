'use client';

import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import {
  EMPTY_QUERY,
  parseListingQuery,
  type FacetOption,
  type Facets,
  type ListingQuery,
} from '@/modules/catalog/listing';
import { useTranslation } from '@/lib/i18n/context';
import {
  translateSize,
  translateColor,
  translateDetailValue,
  toBengaliDigits,
} from '@/lib/i18n/catalog-translator';

export type FilterSection = 'size' | 'color' | 'fit' | 'fabric' | 'price';

interface Draft {
  size: string[];
  color: string[];
  fit: string[];
  fabric: string[];
  min: string;
  max: string;
  inStock: boolean;
}

const draftFrom = (query: ListingQuery): Draft => ({
  size: query.size,
  color: query.color,
  fit: query.fit,
  fabric: query.fabric,
  min: query.minPrice ?? '',
  max: query.maxPrice ?? '',
  inStock: query.inStock,
});

const PRICE_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: ListingQuery;
  facets: Facets;
  /** Section to scroll to when the drawer opens from a quick chip. */
  section: FilterSection | null;
  onApply: (next: ListingQuery) => void;
}

/**
 * Every filter, in a drawer. Choices are held in a draft and applied together, so the page only
 * navigates once. The address is the single source of truth: the drawer starts from it each time.
 */
export function FilterDrawer(props: FilterDrawerProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right">
        <FilterDrawerBody {...props} />
      </SheetContent>
    </Sheet>
  );
}

function FilterDrawerBody({
  open,
  onOpenChange,
  query,
  facets,
  section,
  onApply,
}: FilterDrawerProps) {
  const { locale } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(query));
  const [priceError, setPriceError] = useState<string | null>(null);
  const baseId = useId();

  const optionAriaLabel = (option: FacetOption, translatedName: string) => {
    const count = locale === 'bn' ? toBengaliDigits(option.count) : option.count;
    const unit = locale === 'bn' ? 'টি পোশাক' : option.count === 1 ? 'piece' : 'pieces';
    return `${translatedName}, ${count} ${unit}`;
  };

  useEffect(() => {
    if (!open || !section) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`${baseId}-${section}`)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, section, baseId]);

  const apply = () => {
    const min = draft.min.trim();
    const max = draft.max.trim();
    if ((min && !PRICE_PATTERN.test(min)) || (max && !PRICE_PATTERN.test(max))) {
      setPriceError(
        locale === 'bn'
          ? 'পূর্ণ টাকা বা টাকা ও পয়সা লিখুন, যেমন ২৫০০ বা ২৫০০.৫০।'
          : 'Enter whole taka or taka and paisa, for example 2500 or 2500.50.',
      );
      return;
    }
    const next = parseListingQuery({
      size: draft.size,
      color: draft.color,
      fit: draft.fit,
      fabric: draft.fabric,
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
      ...(draft.inStock ? { instock: '1' } : {}),
      sort: query.sort,
      ...(query.density !== null ? { density: String(query.density) } : {}),
    });
    onApply({ ...next, page: 1 });
    onOpenChange(false);
  };

  const clear = () => {
    setDraft(draftFrom(EMPTY_QUERY));
    setPriceError(null);
  };

  const placeholderMin = facets.priceRange?.min ?? '0';
  const placeholderMax = facets.priceRange?.max ?? '';

  return (
    <>
      <SheetHeader>
        <SheetTitle>{locale === 'bn' ? 'ফিল্টার' : 'Filters'}</SheetTitle>
        <SheetDescription id={`${baseId}-description`}>
          {locale === 'bn'
            ? 'পছন্দ অনুযায়ী নির্বাচন করুন এবং প্রয়োগ করুন। সংখ্যা মিল পাওয়া পোশাকের পরিমাণ নির্দেশ করে।'
            : 'Choose what to show, then apply. Counts show how many pieces match.'}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-10">
        <FilterSet
          id={`${baseId}-size`}
          legend={locale === 'bn' ? 'সাইজ' : 'Size'}
          hidden={facets.size.length === 0}
        >
          <div className="flex flex-wrap gap-2">
            {facets.size.map((option) => {
              const selected = draft.size.includes(option.value);
              const labelText = translateSize(option.label, locale);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={optionAriaLabel(option, labelText)}
                  disabled={option.count === 0 && !selected}
                  onClick={() => setDraft((d) => ({ ...d, size: toggle(d.size, option.value) }))}
                  className={cn(
                    'touch-target inline-flex h-11 min-w-11 items-center justify-center border px-3 type-small transition-auren-fast',
                    selected
                      ? 'border-fg bg-fg text-page'
                      : 'border-line-strong text-fg hover:border-fg',
                    'disabled:cursor-not-allowed disabled:border-line disabled:text-fg-muted disabled:line-through',
                  )}
                >
                  {labelText}
                </button>
              );
            })}
          </div>
        </FilterSet>

        <FilterSet
          id={`${baseId}-color`}
          legend={locale === 'bn' ? 'রং' : 'Colour'}
          hidden={facets.color.length === 0}
        >
          <div className="grid grid-cols-2 gap-2">
            {facets.color.map((option) => {
              const selected = draft.color.includes(option.value);
              const fill = option.hex && /^#[0-9a-f]{3,8}$/i.test(option.hex) ? option.hex : null;
              const labelText = translateColor(option.label, locale);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={optionAriaLabel(option, labelText)}
                  disabled={option.count === 0 && !selected}
                  onClick={() => setDraft((d) => ({ ...d, color: toggle(d.color, option.value) }))}
                  className={cn(
                    'touch-target flex min-h-11 items-center gap-3 border px-3 text-left type-small transition-auren-fast',
                    selected ? 'border-fg' : 'border-line-strong hover:border-fg',
                    'disabled:cursor-not-allowed disabled:border-line disabled:text-fg-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    style={fill ? { backgroundColor: fill } : undefined}
                    className={cn(
                      'block size-5 shrink-0 rounded-full border border-line-strong',
                      !fill && 'bg-sunken',
                      selected && 'ring-1 ring-fg ring-offset-2 ring-offset-raised',
                    )}
                  />
                  <span className="flex-1 truncate">{labelText}</span>
                  <span aria-hidden="true" className="text-fg-muted tabular-nums">
                    {locale === 'bn' ? toBengaliDigits(option.count) : option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSet>

        <FilterSet
          id={`${baseId}-fit`}
          legend={locale === 'bn' ? 'ফিট' : 'Fit'}
          hidden={facets.fit.length === 0}
        >
          <div className="flex flex-wrap gap-2">
            {facets.fit.map((option) => {
              const selected = draft.fit.includes(option.value);
              const labelText = translateDetailValue(option.label, locale);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={optionAriaLabel(option, labelText)}
                  disabled={option.count === 0 && !selected}
                  onClick={() => setDraft((d) => ({ ...d, fit: toggle(d.fit, option.value) }))}
                  className={cn(
                    'touch-target inline-flex min-h-11 items-center gap-2 border px-4 type-small transition-auren-fast',
                    selected
                      ? 'border-fg bg-fg text-page'
                      : 'border-line-strong text-fg hover:border-fg',
                    'disabled:cursor-not-allowed disabled:border-line disabled:text-fg-muted',
                  )}
                >
                  {labelText}
                  <span aria-hidden="true" className="tabular-nums opacity-70">
                    {locale === 'bn' ? toBengaliDigits(option.count) : option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSet>

        <FilterSet
          id={`${baseId}-fabric`}
          legend={locale === 'bn' ? 'ফ্যাব্রিক' : 'Fabric'}
          hidden={facets.fabric.length === 0}
        >
          <ul className="flex flex-col">
            {facets.fabric.map((option) => {
              const selected = draft.fabric.includes(option.value);
              const labelText = translateDetailValue(option.label, locale);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={optionAriaLabel(option, labelText)}
                    disabled={option.count === 0 && !selected}
                    onClick={() =>
                      setDraft((d) => ({ ...d, fabric: toggle(d.fabric, option.value) }))
                    }
                    className={cn(
                      'touch-target flex min-h-11 w-full items-center justify-between gap-3 border-b border-line py-2 text-left type-body transition-auren-fast',
                      selected ? 'text-fg underline decoration-gold underline-offset-4' : 'text-fg',
                      'hover:text-accent-text disabled:cursor-not-allowed disabled:text-fg-muted',
                    )}
                  >
                    <span>{labelText}</span>
                    <span aria-hidden="true" className="type-small text-fg-muted tabular-nums">
                      {locale === 'bn' ? toBengaliDigits(option.count) : option.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterSet>

        <FilterSet
          id={`${baseId}-price`}
          legend={locale === 'bn' ? 'মূল্য' : 'Price'}
          hidden={facets.priceRange === null}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 type-small text-fg-muted">
              {locale === 'bn' ? 'সর্বনিম্ন (৳)' : 'Minimum (৳)'}
              <Input
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholderMin}
                value={draft.min}
                invalid={priceError !== null}
                aria-describedby={priceError ? `${baseId}-price-error` : undefined}
                onChange={(event) => setDraft((d) => ({ ...d, min: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 type-small text-fg-muted">
              {locale === 'bn' ? 'সর্বোচ্চ (৳)' : 'Maximum (৳)'}
              <Input
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholderMax}
                value={draft.max}
                invalid={priceError !== null}
                aria-describedby={priceError ? `${baseId}-price-error` : undefined}
                onChange={(event) => setDraft((d) => ({ ...d, max: event.target.value }))}
              />
            </label>
          </div>
          {priceError ? (
            <p
              id={`${baseId}-price-error`}
              role="alert"
              className="mt-2 type-small text-danger-text"
            >
              {priceError}
            </p>
          ) : null}
        </FilterSet>

        <div>
          <Switch
            label={locale === 'bn' ? 'শুধুমাত্র স্টকে আছে এমন' : 'In stock only'}
            checked={draft.inStock}
            onCheckedChange={(checked) => setDraft((d) => ({ ...d, inStock: checked }))}
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" onClick={apply} size="lg" fullWidth>
          {locale === 'bn' ? 'ফিল্টার প্রয়োগ করুন' : 'Apply filters'}
        </Button>
        <Button type="button" onClick={clear} variant="link" className="self-center">
          {locale === 'bn' ? 'সব মুছে ফেলুন' : 'Clear all'}
        </Button>
      </SheetFooter>
    </>
  );
}

function FilterSet({
  id,
  legend,
  hidden,
  children,
}: {
  id: string;
  legend: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <fieldset id={id} className="min-w-0 scroll-mt-2">
      <legend className="mb-4 type-eyebrow text-fg-muted">{legend}</legend>
      {children}
    </fieldset>
  );
}
