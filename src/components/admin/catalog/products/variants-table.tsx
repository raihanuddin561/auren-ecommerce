'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { updateVariants } from '@/modules/catalog/actions';
import type { ProductView } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { failureMessage, fieldErrorsOf } from '../../action-feedback';
import { STATUS_LABEL } from './product-status';
import {
  applyPriceToAll,
  mapVariantErrors,
  rowsChanged,
  rowsFromProduct,
  toVariantsPayload,
  validateVariantRows,
  variantTitle,
  type EditableField,
  type RowErrors,
  type VariantRow,
  type VariantStatus,
} from './variants-logic';
import { isMoneyText } from './variant-preview';

interface VariantsTableProps {
  product: ProductView;
  canWrite: boolean;
  showCost: boolean;
  canSeeStock: boolean;
}

const th = 'border-b border-line px-3 py-3 text-left type-eyebrow text-fg-muted whitespace-nowrap';
const td = 'px-2 py-2 align-top';

/** The variant rows with inline editing and one Save. Errors land on the row and cell they belong to. */
export function VariantsTable({ product, canWrite, showCost, canSeeStock }: VariantsTableProps) {
  const router = useRouter();
  const captionId = useId();
  const [baseline, setBaseline] = useState(() => rowsFromProduct(product.variants));
  const [rows, setRows] = useState(baseline);
  const [errors, setErrors] = useState<RowErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  const dirty = rowsChanged(rows, baseline);
  // Stock and cost are read live from the server data, never from the editable row state, so a
  // change made in inventory shows up here after a refresh.
  const live = new Map(product.variants.map((v) => [v.id, v]));

  function edit(index: number, field: EditableField, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setErrors((current) => {
      const cell = current[index];
      if (!cell?.[field]) return current;
      const { [field]: _removed, ...rest } = cell;
      return { ...current, [index]: rest };
    });
  }

  function applyBulk() {
    if (!isMoneyText(bulkPrice)) {
      return void setBulkError('Enter an amount such as 2490 or 2,490.50');
    }
    setBulkError(null);
    setRows((current) => applyPriceToAll(current, bulkPrice.trim()));
  }

  async function save() {
    const local = validateVariantRows(product.id, rows);
    if (Object.keys(local.rows).length > 0 || local.other.length > 0) {
      setErrors(local.rows);
      setFormErrors(local.other);
      toast.error('Variants were not saved', 'Check the highlighted cells.');
      return;
    }
    setSaving(true);
    setErrors({});
    setFormErrors([]);
    const result = await updateVariants(toVariantsPayload(product.id, rows));
    setSaving(false);
    if (!result.ok) {
      const mapped = mapVariantErrors(fieldErrorsOf(result));
      setErrors(mapped.rows);
      const message = failureMessage(result);
      setFormErrors(mapped.other.length > 0 ? mapped.other : message ? [message] : []);
      toast.error(
        'Variants were not saved',
        'Your edits are still here. Check the highlighted cells.',
      );
      return;
    }
    setBaseline(rows);
    toast.success('Variants saved');
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="type-h3 text-fg">Variants</h3>
        <p className="type-admin text-fg-muted">
          No variants yet. Add options above and generate them to set prices and SKUs.
        </p>
      </div>
    );
  }

  const cellError = (index: number, field: EditableField) => errors[index]?.[field] ?? null;

  function textCell(row: VariantRow, index: number, field: EditableField, extra?: string) {
    const message = cellError(index, field);
    const id = `${captionId}-${index}-${field}`;
    return (
      <>
        <Input
          id={id}
          aria-label={`${extra ?? field} for ${variantTitle(row)}`}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          value={row[field]}
          inputMode={field === 'price' || field === 'compareAt' ? 'decimal' : undefined}
          className="h-10 min-w-28 px-3 type-admin"
          onChange={(event) => edit(index, field, event.target.value)}
        />
        {message ? (
          <p id={`${id}-error`} role="alert" className="mt-1 max-w-48 type-small text-danger-text">
            {message}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="type-h3 text-fg">Variants</h3>
      <fieldset disabled={!canWrite} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <legend className="sr-only">Variant details</legend>
        <div className="flex flex-wrap items-start gap-3">
          <FormField
            label="Price for every row"
            hint="Fills the price column. Nothing is saved until you save variants."
            error={bulkError}
            className="min-w-0 basis-64"
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={bulkPrice}
                maxLength={20}
                onChange={(event) => setBulkPrice(event.target.value)}
              />
            )}
          </FormField>
          <Button type="button" variant="secondary" size="sm" className="mt-7" onClick={applyBulk}>
            Apply price to all rows
          </Button>
        </div>

        <div
          role="region"
          tabIndex={0}
          aria-labelledby={captionId}
          className="overflow-x-auto border border-line bg-raised"
        >
          <table className="w-full min-w-[78rem] border-collapse type-admin">
            <caption id={captionId} className="sr-only">
              Variants of {product.title}
            </caption>
            <thead>
              <tr>
                <th scope="col" className={`${th} sticky left-0 z-10 bg-raised`}>
                  Variant
                </th>
                <th scope="col" className={th}>
                  SKU
                </th>
                <th scope="col" className={th}>
                  Barcode
                </th>
                <th scope="col" className={th}>
                  Price
                </th>
                <th scope="col" className={th}>
                  Compare-at
                </th>
                <th scope="col" className={th}>
                  Weight (g)
                </th>
                <th scope="col" className={th}>
                  Status
                </th>
                <th scope="col" className={`${th} text-right`}>
                  On hand
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Available
                </th>
                {showCost ? (
                  <th scope="col" className={`${th} text-right`}>
                    Cost
                  </th>
                ) : null}
                <th scope="col" className={th}>
                  Stock and cost
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-36 border-r border-line bg-raised px-3 py-3 text-left align-top font-medium"
                  >
                    {variantTitle(row)}
                  </th>
                  <td className={td}>{textCell(row, index, 'sku', 'SKU')}</td>
                  <td className={td}>{textCell(row, index, 'barcode', 'Barcode')}</td>
                  <td className={td}>{textCell(row, index, 'price', 'Price')}</td>
                  <td className={td}>{textCell(row, index, 'compareAt', 'Compare-at price')}</td>
                  <td className={td}>{textCell(row, index, 'weightG', 'Weight in grams')}</td>
                  <td className={td}>
                    <Select
                      value={row.status}
                      onValueChange={(value) => edit(index, 'status', value as VariantStatus)}
                    >
                      <SelectTrigger
                        aria-label={`Status for ${variantTitle(row)}`}
                        invalid={Boolean(cellError(index, 'status'))}
                        className="h-10 min-w-32 px-3 type-admin"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['draft', 'active', 'archived'] as const).map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cellError(index, 'status') ? (
                      <p role="alert" className="mt-1 max-w-48 type-small text-danger-text">
                        {cellError(index, 'status')}
                      </p>
                    ) : null}
                  </td>
                  <td className={`${td} pt-4 text-right tabular-nums`}>
                    {live.get(row.id)?.onHand ?? row.onHand}
                  </td>
                  <td className={`${td} pt-4 text-right font-medium tabular-nums`}>
                    {live.get(row.id)?.available ?? 0}
                  </td>
                  {showCost ? (
                    <td className={`${td} pt-4 text-right tabular-nums`}>
                      {live.get(row.id)?.avgCost ?? <span className="text-fg-muted">None</span>}
                    </td>
                  ) : null}
                  <td className={`${td} pt-3`}>
                    <StockCostCell
                      variantTitle={variantTitle(row)}
                      sku={row.sku}
                      hasCost={live.get(row.id)?.hasCost ?? false}
                      canSeeStock={canSeeStock}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="type-small text-fg-muted">
          On hand, available and cost are read only: stock changes in inventory, and cost comes from
          purchase receipts or the unit cost entered when adding stock.
        </p>
      </fieldset>

      {formErrors.length > 0 ? (
        <div role="alert" className="type-small text-danger-text">
          {formErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p role="status" aria-live="polite" className="type-small text-fg-muted">
            {saving ? 'Saving' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
          <Button
            size="sm"
            loading={saving}
            disabled={!dirty && !saving}
            onClick={() => void save()}
          >
            Save variants
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A warning chip when the variant has no cost (it cannot be ordered) and links to fix it in inventory. */
function StockCostCell({
  variantTitle,
  sku,
  hasCost,
  canSeeStock,
}: {
  variantTitle: string;
  sku: string;
  hasCost: boolean;
  canSeeStock: boolean;
}) {
  const href = `/admin/inventory?q=${encodeURIComponent(sku)}`;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {hasCost ? null : <Badge tone="danger">No cost: cannot be ordered</Badge>}
      {canSeeStock ? (
        <span className="flex flex-wrap gap-x-3">
          <Link
            href={href}
            aria-label={`Adjust stock for ${variantTitle}`}
            className="type-small text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
          >
            Adjust stock
          </Link>
          {hasCost ? null : (
            <Link
              href={href}
              aria-label={`Set cost for ${variantTitle}`}
              className="type-small text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
            >
              Set cost
            </Link>
          )}
        </span>
      ) : null}
    </div>
  );
}
