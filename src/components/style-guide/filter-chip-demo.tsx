'use client';

import { useState } from 'react';
import { FilterChip } from '@/components/ui/chip';

const FILTERS = ['Size', 'Colour', 'Fit', 'In stock'] as const;

export function FilterChipDemo() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(['Colour']));
  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <>
      {FILTERS.map((name) => (
        <FilterChip key={name} selected={selected.has(name)} onClick={() => toggle(name)}>
          {name}
        </FilterChip>
      ))}
      <FilterChip disabled>Unavailable</FilterChip>
    </>
  );
}
