'use client';

import { Ruler } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { PdpSizeChart } from '@/modules/catalog/pdp';

/**
 * A rough guide from height and weight to a letter size. It is a starting point, never a promise:
 * the copy says so, and the measurement chart above it is the real reference.
 */
export function suggestSize(
  heightCm: number,
  weightKg: number,
  offered?: readonly string[],
): string | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null;
  if (heightCm < 140 || heightCm > 220 || weightKg < 35 || weightKg > 200) return null;
  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);
  // Build index first, then lift one size for very tall men.
  let index = bmi < 20 ? 0 : bmi < 23.5 ? 1 : bmi < 27 ? 2 : bmi < 31 ? 3 : 4;
  if (heightCm >= 188 && index < 4) index += 1;
  const size = ['S', 'M', 'L', 'XL', 'XXL'][index] ?? null;
  // Never suggest a size this piece is not made in.
  return size && (!offered || offered.some((label) => label.toUpperCase() === size)) ? size : null;
}

function FindMySize({ offered }: { offered: readonly string[] }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const result = height && weight ? suggestSize(Number(height), Number(weight), offered) : null;
  const touched = Boolean(height && weight);

  return (
    <section aria-labelledby="find-size" className="border border-line p-4">
      <h3 id="find-size" className="type-eyebrow text-fg">
        Find my size
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <FormField label="Height (cm)">
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              placeholder="180"
            />
          )}
        </FormField>
        <FormField label="Weight (kg)">
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="75"
            />
          )}
        </FormField>
      </div>
      <p role="status" className="mt-3 min-h-5 type-small text-fg-muted">
        {result
          ? `We suggest ${result}. Check the chart before you decide; fit differs by style.`
          : touched
            ? 'We cannot suggest a size for these numbers. Check the chart or ask our concierge.'
            : ''}
      </p>
    </section>
  );
}

interface SizeGuideDrawerProps {
  chart: PdpSizeChart | null;
  title: string;
  /** Sizes of letter kind get the helper; waist sizes (30, 32 ...) do not. */
  showHelper: boolean;
  /** Size labels this piece is made in. */
  offered?: readonly string[];
}

/** Chart, how to measure, model information and the helper, in a drawer. */
export function SizeGuideDrawer({ chart, title, showHelper, offered = [] }: SizeGuideDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex min-h-11 items-center gap-2 type-small text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2">
        <Icon icon={Ruler} size={16} />
        Size guide
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Size guide</SheetTitle>
          <SheetDescription>{title}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          {chart ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse type-small">
                  <caption className="mb-2 text-left type-eyebrow text-fg-muted">
                    {chart.name} ({chart.unit})
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-line py-2 pr-3 text-left">
                        Size
                      </th>
                      {chart.columns.map((column, columnIndex) => (
                        <th
                          key={`${column}-${columnIndex}`}
                          scope="col"
                          className="border-b border-line px-2 py-2 text-right"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.rows.map((row) => (
                      <tr key={`${row.size}-${chart.rows.indexOf(row)}`}>
                        <th scope="row" className="border-b border-line py-2 pr-3 text-left">
                          {row.size}
                        </th>
                        {chart.columns.map((column, index) => (
                          <td
                            key={`${column}-${index}`}
                            className="border-b border-line px-2 py-2 text-right tabular-nums"
                          >
                            {row.values[index] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {chart.modelInfo ? (
                <p className="type-small text-fg-muted">{chart.modelInfo}</p>
              ) : null}
              {chart.howToMeasure ? (
                <section aria-labelledby="how-to-measure">
                  <h3 id="how-to-measure" className="type-eyebrow text-fg">
                    How to measure
                  </h3>
                  <div className="mt-2 flex flex-col gap-2 type-small text-fg-muted">
                    {chart.howToMeasure.split(/\r?\n\s*\r?\n/).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="type-small text-fg-muted">
              There is no size chart for this piece yet. If you are between sizes, our concierge
              will happily help you choose.
            </p>
          )}
          {showHelper ? <FindMySize offered={offered} /> : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
