'use client';

import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducer, useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormActions, FormSection, type SaveStatus } from '@/components/admin/form-section';
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
import { createSizeChart, updateSizeChart } from '@/modules/catalog/actions';
import {
  cellHasError,
  createGrid,
  gridErrorLines,
  gridReducer,
  MAX_CELL_LENGTH,
  MAX_COLUMNS,
  MAX_ROWS,
  toTable,
} from './grid';

export interface SizeChartFormValues {
  id: string;
  name: string;
  unit: 'cm' | 'in';
  table: { columns: string[]; rows: Array<{ size: string; values: string[] }> };
  howToMeasure: string | null;
  modelInfo: string | null;
}

interface SizeChartFormProps {
  chart?: SizeChartFormValues;
  canWrite: boolean;
}

const HOW_TO_MEASURE_MAX = 2000;
const MODEL_INFO_MAX = 500;

const cellClass = 'h-10 min-w-24 px-2 type-admin';

export function SizeChartForm({ chart, canWrite }: SizeChartFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const [name, setName] = useState(chart?.name ?? '');
  const [unit, setUnit] = useState<'cm' | 'in'>(chart?.unit ?? 'cm');
  const [grid, dispatch] = useReducer(gridReducer, chart?.table, createGrid);
  const [howToMeasure, setHowToMeasure] = useState(chart?.howToMeasure ?? '');
  const [modelInfo, setModelInfo] = useState(chart?.modelInfo ?? '');

  const touch = () => setStatus((current) => (current === 'saving' ? current : 'dirty'));
  const change = (action: Parameters<typeof dispatch>[0], message?: string) => {
    dispatch(action);
    if (message) setAnnouncement(message);
    touch();
  };

  const gridLines = gridErrorLines(errors, grid.columns);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setErrors({});
    setFormError(null);
    setStatus('saving');
    const payload = {
      ...(chart ? { id: chart.id } : {}),
      name,
      unit,
      ...toTable(grid),
      howToMeasure,
      modelInfo,
    };
    startTransition(async () => {
      const result = chart ? await updateSizeChart(payload) : await createSizeChart(payload);
      if (!result.ok) {
        const fieldErrors = fieldErrorsOf(result);
        const general = Object.keys(fieldErrors).length === 0 || Boolean(fieldErrors['_form']);
        setErrors(fieldErrors);
        setFormError(general ? failureMessage(result) : null);
        setStatus('error');
        toast.error(failureMessage(result) ?? 'The size chart could not be saved.');
        return;
      }
      setStatus('saved');
      if (chart) {
        toast.success('Size chart saved');
        router.refresh();
      } else {
        toast.success('Size chart created');
        router.push('/admin/size-charts');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label={chart ? 'Edit size chart' : 'New size chart'}>
      <fieldset disabled={!canWrite || pending} className="flex flex-col gap-6 border-0 p-0">
        <legend className="sr-only">Size chart details</legend>
        {formError ? (
          <p
            role="alert"
            className="border border-danger bg-raised p-4 type-admin text-danger-text"
          >
            {formError}
          </p>
        ) : null}

        <FormSection
          title="Details"
          description="Name the chart so it is easy to find on a product."
        >
          <FormField
            label="Name"
            required
            error={firstError(errors, 'name')}
            hint="For example Shirts, regular fit."
          >
            {(control) => (
              <Input
                {...control}
                name="name"
                value={name}
                maxLength={80}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
          <FormField
            label="Unit"
            error={firstError(errors, 'unit')}
            hint="Applies to every measurement."
          >
            {(control) => (
              <Select
                value={unit}
                onValueChange={(value) => {
                  setUnit(value === 'in' ? 'in' : 'cm');
                  touch();
                }}
              >
                <SelectTrigger
                  id={control.id}
                  aria-describedby={control['aria-describedby']}
                  invalid={Boolean(control['aria-invalid'])}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">Centimetres (cm)</SelectItem>
                  <SelectItem value="in">Inches (in)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        </FormSection>

        <section
          aria-labelledby="chart-grid-title"
          className="flex flex-col gap-4 border border-line bg-raised p-5 md:p-6"
        >
          <div>
            <h2 id="chart-grid-title" className="type-h3 text-fg">
              Sizes and measurements
            </h2>
            <p className="mt-1 type-admin text-fg-muted">
              Up to {MAX_COLUMNS} measurements and {MAX_ROWS} sizes. Values are free text up to{' '}
              {MAX_CELL_LENGTH} characters, such as 96-100.
            </p>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Size chart editor"
            className="overflow-x-auto border border-line"
          >
            <table className="w-full border-collapse type-admin">
              <thead>
                <tr className="bg-sunken">
                  <th scope="col" className="min-w-24 p-2 text-left type-eyebrow text-fg-muted">
                    Size
                  </th>
                  {grid.columns.map((column, index) => (
                    <th key={index} scope="col" className="p-2 text-left align-top font-normal">
                      <div className="flex items-center gap-1">
                        <Input
                          aria-label={`Measurement ${index + 1} name`}
                          aria-invalid={cellHasError(errors, `columns.${index}`) || undefined}
                          className={cellClass}
                          value={column}
                          maxLength={MAX_CELL_LENGTH}
                          placeholder="Chest"
                          onChange={(event) =>
                            change({ type: 'renameColumn', index, name: event.target.value })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove measurement ${index + 1}${column ? `, ${column}` : ''}`}
                          disabled={grid.columns.length <= 1}
                          onClick={() =>
                            change(
                              { type: 'removeColumn', index },
                              `Measurement ${index + 1} removed`,
                            )
                          }
                        >
                          <Icon icon={X} size={16} />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th scope="col" className="p-2">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, rowIndex) => (
                  <tr key={row.key} className="border-t border-line">
                    <th scope="row" className="p-2 text-left font-normal">
                      <Input
                        aria-label={`Size, row ${rowIndex + 1}`}
                        aria-invalid={cellHasError(errors, `rows.${rowIndex}.size`) || undefined}
                        className={cellClass}
                        value={row.size}
                        maxLength={MAX_CELL_LENGTH}
                        placeholder="M"
                        onChange={(event) =>
                          change({ type: 'setSize', index: rowIndex, size: event.target.value })
                        }
                      />
                    </th>
                    {grid.columns.map((column, columnIndex) => (
                      <td key={columnIndex} className="p-2">
                        <Input
                          aria-label={`Row ${rowIndex + 1}, ${column || `measurement ${columnIndex + 1}`}`}
                          aria-invalid={
                            cellHasError(errors, `rows.${rowIndex}.values.${columnIndex}`) ||
                            undefined
                          }
                          className={cellClass}
                          value={row.values[columnIndex] ?? ''}
                          maxLength={MAX_CELL_LENGTH}
                          onChange={(event) =>
                            change({
                              type: 'setValue',
                              row: rowIndex,
                              column: columnIndex,
                              value: event.target.value,
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove row ${rowIndex + 1}${row.size ? `, size ${row.size}` : ''}`}
                        disabled={grid.rows.length <= 1}
                        onClick={() =>
                          change(
                            { type: 'removeRow', index: rowIndex },
                            `Row ${rowIndex + 1} removed`,
                          )
                        }
                      >
                        <Icon icon={X} size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={grid.rows.length >= MAX_ROWS}
              onClick={() => change({ type: 'addRow' }, `Row ${grid.rows.length + 1} added`)}
            >
              <Icon icon={Plus} size={16} />
              Add size
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={grid.columns.length >= MAX_COLUMNS}
              onClick={() =>
                change({ type: 'addColumn' }, `Measurement ${grid.columns.length + 1} added`)
              }
            >
              <Icon icon={Plus} size={16} />
              Add measurement
            </Button>
          </div>

          {gridLines.length > 0 ? (
            <ul role="alert" className="list-disc pl-5 type-small text-danger-text">
              {gridLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>

        <FormSection title="Guidance" description="Shown beside the table on the product page.">
          <FormField
            label="How to measure"
            error={firstError(errors, 'howToMeasure')}
            hint={`Markdown is supported. ${howToMeasure.length} of ${HOW_TO_MEASURE_MAX} characters.`}
          >
            {(control) => (
              <Textarea
                {...control}
                name="howToMeasure"
                value={howToMeasure}
                rows={6}
                onChange={(event) => {
                  setHowToMeasure(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
          <FormField
            label="Model info"
            error={firstError(errors, 'modelInfo')}
            hint={`For example: Model is 185 cm and wears size M. ${modelInfo.length} of ${MODEL_INFO_MAX} characters.`}
          >
            {(control) => (
              <Textarea
                {...control}
                name="modelInfo"
                value={modelInfo}
                rows={2}
                onChange={(event) => {
                  setModelInfo(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
        </FormSection>
      </fieldset>

      <section
        aria-labelledby="chart-preview-title"
        className="mt-6 flex flex-col gap-3 border border-line bg-raised p-5 md:p-6"
      >
        <h2 id="chart-preview-title" className="type-h3 text-fg">
          Preview
        </h2>
        <p className="type-admin text-fg-muted">
          How the table reads to shoppers. Empty cells show as a dash.
        </p>
        <div tabIndex={0} role="region" aria-label="Size chart preview" className="overflow-x-auto">
          <table className="w-full border-collapse type-admin">
            <caption className="pb-2 text-left type-small text-fg-muted">
              {name.trim() || 'Untitled size chart'}, measurements in {unit}
            </caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="px-3 py-2 text-left type-eyebrow text-fg-muted">
                  Size
                </th>
                {grid.columns.map((column, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="px-3 py-2 text-left type-eyebrow text-fg-muted"
                  >
                    {column.trim() || `Measurement ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                    {row.size.trim() || '-'}
                  </th>
                  {grid.columns.map((_, columnIndex) => (
                    <td key={columnIndex} className="px-3 py-2 text-fg tabular-nums">
                      {row.values[columnIndex]?.trim() || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {modelInfo.trim() ? <p className="type-admin text-fg-muted">{modelInfo.trim()}</p> : null}
      </section>

      {canWrite ? (
        <FormActions status={status}>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/size-charts">Cancel</Link>
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {chart ? 'Save changes' : 'Create size chart'}
          </Button>
        </FormActions>
      ) : (
        <p className="mt-6 type-admin text-fg-muted">
          You can view this size chart but not change it.
        </p>
      )}
    </form>
  );
}
