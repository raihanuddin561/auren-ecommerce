'use client';

import { Columns2, Columns3, Columns4, Rows3, SlidersHorizontal, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition, type ComponentProps } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  activeFilterCount,
  listingHref,
  SORT_LABELS,
  SORT_VALUES,
  type Density,
  type Facets,
  type ListingQuery,
  type ListingSort,
} from '@/modules/catalog/listing';
import { FilterDrawer, type FilterSection } from './filter-drawer';

interface ListingControlsProps {
  basePath: string;
  query: ListingQuery;
  facets: Facets;
  total: number;
}

/** Desktop columns a density stands for (the grid classes in modules/catalog/listing.ts). */
const desktopColumns = (density: Density | null): 2 | 3 | 4 =>
  density === 2 ? 2 : density === 3 || density === 1 ? 3 : 4;
const phoneColumns = (density: Density | null): 1 | 2 => (density === 1 ? 1 : 2);

const DESKTOP_DENSITIES: Array<{
  columns: 2 | 3 | 4;
  density: Density | null;
  icon: typeof Columns2;
}> = [
  { columns: 2, density: 2, icon: Columns2 },
  { columns: 3, density: 3, icon: Columns3 },
  { columns: 4, density: null, icon: Columns4 },
];

/**
 * The sticky bar of a shop or collection page: Filter (with a count), quick chips, Sort and the
 * grid density toggle. Everything it changes goes into the address, so the page stays shareable
 * and works with the back button.
 */
export function ListingControls({ basePath, query, facets, total }: ListingControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<FilterSection | null>(null);

  const go = useCallback(
    (next: ListingQuery) => {
      startTransition(() => {
        router.replace(listingHref(basePath, { ...next, page: 1 }), { scroll: false });
      });
    },
    [basePath, router],
  );

  const openDrawer = (target: FilterSection | null) => {
    setSection(target);
    setOpen(true);
  };

  const count = activeFilterCount(query);
  const chips: Array<{ key: FilterSection; label: string; selected: number; shown: boolean }> = [
    { key: 'size', label: 'Size', selected: query.size.length, shown: facets.size.length > 0 },
    { key: 'color', label: 'Colour', selected: query.color.length, shown: facets.color.length > 0 },
    { key: 'fit', label: 'Fit', selected: query.fit.length, shown: facets.fit.length > 0 },
  ];

  return (
    <div
      aria-busy={pending}
      className="sticky top-(--header-height) z-30 border-y border-line bg-page"
    >
      <div className="container-page flex min-h-14 items-center gap-3 py-2">
        <ChipButton active={count > 0} onClick={() => openDrawer(null)} className="shrink-0">
          <Icon icon={SlidersHorizontal} size={16} />
          Filter
          {count > 0 ? (
            <span className="tabular-nums">
              <span aria-hidden="true">({count})</span>
              <span className="sr-only">, {count} selected</span>
            </span>
          ) : null}
        </ChipButton>

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          {chips
            .filter((chip) => chip.shown)
            .map((chip) => (
              <ChipButton
                key={chip.key}
                active={chip.selected > 0}
                onClick={() => openDrawer(chip.key)}
              >
                {chip.label}
                {chip.selected > 0 ? (
                  <span className="tabular-nums">
                    <span aria-hidden="true">({chip.selected})</span>
                    <span className="sr-only">, {chip.selected} selected</span>
                  </span>
                ) : null}
              </ChipButton>
            ))}
        </div>

        <p role="status" className="ml-auto hidden type-small text-fg-muted md:block">
          {total} {total === 1 ? 'piece' : 'pieces'}
        </p>

        <div className="ml-auto flex min-w-0 items-center gap-1 md:ml-0 md:gap-2">
          <label className="sr-only" htmlFor="listing-sort">
            Sort by
          </label>
          <Select
            value={query.sort}
            onValueChange={(value) => go({ ...query, sort: value as ListingSort })}
          >
            <SelectTrigger
              id="listing-sort"
              className="h-11 w-auto max-w-34 min-w-0 px-3 type-small sm:max-w-none sm:min-w-44 sm:px-4"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Desktop: two, three or four columns. */}
          <div role="group" aria-label="Columns" className="hidden items-center md:flex">
            {DESKTOP_DENSITIES.map(({ columns, density, icon }) => {
              const pressed = desktopColumns(query.density) === columns;
              return (
                <DensityButton
                  key={columns}
                  label={`${columns} columns`}
                  pressed={pressed}
                  icon={icon}
                  onClick={() => go({ ...query, density })}
                />
              );
            })}
          </div>
          {/* Phone: one or two columns. */}
          <div role="group" aria-label="Columns" className="flex items-center md:hidden">
            <DensityButton
              label="1 column"
              pressed={phoneColumns(query.density) === 1}
              icon={Square}
              onClick={() => go({ ...query, density: 1 })}
            />
            <DensityButton
              label="2 columns"
              pressed={phoneColumns(query.density) === 2}
              icon={Rows3}
              onClick={() => go({ ...query, density: null })}
            />
          </div>
        </div>
      </div>
      {pending ? <div aria-hidden="true" className="h-px w-full animate-skeleton bg-gold" /> : null}

      <FilterDrawer
        open={open}
        onOpenChange={setOpen}
        query={query}
        facets={facets}
        section={section}
        onApply={go}
      />
    </div>
  );
}

function DensityButton({
  label,
  pressed,
  icon,
  onClick,
}: {
  label: string;
  pressed: boolean;
  icon: typeof Columns2;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'touch-target inline-flex size-11 items-center justify-center transition-auren-fast',
        pressed ? 'text-fg' : 'text-fg-muted hover:text-fg',
      )}
    >
      <span className={cn('border-b pb-1', pressed ? 'border-gold' : 'border-transparent')}>
        <Icon icon={icon} />
      </span>
    </button>
  );
}

/** A pill that opens the filter drawer (a dialog trigger, so no pressed state). */
function ChipButton({
  active,
  className,
  ...props
}: { active: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={cn(
        'touch-target inline-flex min-h-10 items-center gap-2 rounded-full border px-4 type-small transition-auren-fast',
        active ? 'border-fg bg-fg text-page' : 'border-line-strong text-fg hover:border-fg',
        className,
      )}
      {...props}
    />
  );
}
