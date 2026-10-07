'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { generateVariants } from '@/modules/catalog/actions';
import type { ProductView } from './types';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  failureMessage,
  fieldErrorsOf,
  firstError,
  type FieldErrorMap,
} from '../../action-feedback';
import { ConfirmDialog } from './confirm-dialog';
import { OptionEditor } from './option-editor';
import {
  MAX_OPTIONS,
  describePreview,
  draftFromProduct,
  isMoneyText,
  nextOptionName,
  previewMatrix,
  resolveDraft,
  type DraftOption,
} from './variant-preview';

interface OptionsGeneratorProps {
  product: ProductView;
  sizeCharts?: Array<{ id: string; label: string; sizes: string[] }>;
}

/** Messages the server attached to anything but the two price fields, flattened for one alert. */
function otherMessages(errors: FieldErrorMap): string[] {
  return Object.entries(errors)
    .filter(([key]) => key !== 'defaults.price' && key !== 'defaults.compareAt')
    .flatMap(([, messages]) => messages);
}

let counter = 0;

/**
 * The option matrix: up to three options, a live preview of what will change, and the defaults
 * for the variants that get created. Prices stay as the text typed; the server parses them.
 */
export function OptionsGenerator({ product, sizeCharts }: OptionsGeneratorProps) {
  const router = useRouter();
  const firstVariant = product.variants.find((v) => v.status !== 'archived') ?? product.variants[0];
  const [options, setOptions] = useState<DraftOption[]>(() => draftFromProduct(product.options));
  const [skuPrefix, setSkuPrefix] = useState('');
  const [price, setPrice] = useState(firstVariant?.price ?? '');
  const [compareAt, setCompareAt] = useState(firstVariant?.compareAt ?? '');
  const [weightG, setWeightG] = useState(
    firstVariant?.weightG === null || firstVariant === undefined
      ? ''
      : String(firstVariant.weightG),
  );
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const attachedChart = useMemo(() => {
    if (!product.sizeChartId || !sizeCharts) return null;
    return sizeCharts.find((c) => c.id === product.sizeChartId) ?? null;
  }, [product.sizeChartId, sizeCharts]);

  const preview = useMemo(() => previewMatrix(options, product), [options, product]);
  const resolved = useMemo(
    () => resolveDraft(options, product.options),
    [options, product.options],
  );
  const priceProblem =
    price.trim() === ''
      ? 'Enter a price'
      : isMoneyText(price)
        ? null
        : 'Enter an amount such as 2490 or 2,490.50';
  const compareProblem =
    compareAt.trim() === '' || isMoneyText(compareAt)
      ? null
      : 'Enter an amount such as 2490 or 2,490.50';
  const canSubmit =
    preview.problems.length === 0 && priceProblem === null && compareProblem === null;

  function changeOption(key: string, next: DraftOption) {
    setOptions((current) => current.map((o) => (o.key === key ? next : o)));
    setErrors({});
  }

  function addOption() {
    counter += 1;
    setOptions((current) => [
      ...current,
      { key: `draft-${counter}`, name: nextOptionName(current), values: [] },
    ]);
  }

  function importSizesFromChart() {
    if (!attachedChart || attachedChart.sizes.length === 0) return;
    const existingIndex = options.findIndex((o) => /^size$/i.test(o.name.trim()));
    if (existingIndex >= 0) {
      const existing = options[existingIndex]!;
      const existingLabels = new Set(existing.values.map((v) => v.label.trim().toLowerCase()));
      const addedValues = attachedChart.sizes
        .filter((s) => !existingLabels.has(s.trim().toLowerCase()))
        .map((s) => {
          counter += 1;
          return {
            key: `size-${counter}-${s}`,
            label: s,
            swatchHex: '',
          };
        });
      if (addedValues.length === 0) {
        toast.message('All sizes from this chart are already in the Size option.');
        return;
      }
      changeOption(existing.key, {
        ...existing,
        values: [...existing.values, ...addedValues],
      });
      toast.success(`Added ${addedValues.length} size(s) from "${attachedChart.label}"`);
    } else {
      if (options.length >= MAX_OPTIONS) {
        toast.error(`Cannot add Size option: maximum of ${MAX_OPTIONS} options reached.`);
        return;
      }
      counter += 1;
      const newOption: DraftOption = {
        key: `draft-size-${counter}`,
        name: 'Size',
        values: attachedChart.sizes.map((s, idx) => ({
          key: `size-${counter}-${idx}-${s}`,
          label: s,
          swatchHex: '',
        })),
      };
      setOptions((current) => [...current, newOption]);
      setErrors({});
      toast.success(`Imported ${attachedChart.sizes.length} sizes from "${attachedChart.label}"`);
    }
  }

  async function run() {
    setPending(true);
    setErrors({});
    setFormError(null);
    const result = await generateVariants({
      productId: product.id,
      options: options.map((o, optionIndex) => ({
        // The id of a saved option or value travels with it, so a rename keeps its variants.
        ...(resolved[optionIndex]?.optionId ? { id: resolved[optionIndex]!.optionId! } : {}),
        name: o.name,
        values: o.values.map((v, valueIndex) => ({
          ...(resolved[optionIndex]?.valueIds[valueIndex]
            ? { id: resolved[optionIndex]!.valueIds[valueIndex]! }
            : {}),
          label: v.label,
          swatchHex: v.swatchHex,
        })),
      })),
      defaults: { price, compareAt, weightG, skuPrefix },
    });
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
      toast.error('Variants were not generated', failureMessage(result) ?? undefined);
      return;
    }
    const { created, removed, archived } = result.data;
    toast.success(
      'Variants updated',
      `${created} created, ${removed} removed, ${archived} archived because they have stock history.`,
    );
    router.refresh();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    if (preview.remove > 0) setConfirming(true);
    else void run();
  }

  const serverMessages = otherMessages(errors);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <h3 className="type-h3 text-fg">Options</h3>
      <p className="type-small text-fg-muted">
        Options such as Color, Size or Fit make one variant for each combination. Changing them
        keeps matching variants, adds new ones and removes the rest.
      </p>
      {attachedChart && attachedChart.sizes.length > 0 ? (
        <div className="bg-surface flex flex-col gap-3 border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="type-small font-medium text-fg">
              Attached size chart: <span className="text-fg-muted">{attachedChart.label}</span>
            </p>
            <p className="type-micro text-fg-muted">
              Sizes from chart: {attachedChart.sizes.join(', ')}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={importSizesFromChart}
            className="shrink-0"
          >
            Import sizes to variants
          </Button>
        </div>
      ) : null}
      {options.map((option, index) => (
        <OptionEditor
          key={option.key}
          option={option}
          position={index}
          onChange={(next) => changeOption(option.key, next)}
          onRemove={() => setOptions((current) => current.filter((o) => o.key !== option.key))}
        />
      ))}
      {options.length < MAX_OPTIONS ? (
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addOption}>
            Add option
          </Button>
        </div>
      ) : null}

      <fieldset className="grid min-w-0 gap-4 border border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 type-small font-medium text-fg">Defaults for new variants</legend>
        <FormField label="SKU prefix" hint="Letters and numbers. Blank uses the title.">
          {(control) => (
            <Input
              {...control}
              value={skuPrefix}
              maxLength={12}
              onChange={(event) => setSkuPrefix(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Price"
          required
          hint="For example 2490 or 2,490.50"
          error={priceProblem && price !== '' ? priceProblem : firstError(errors, 'defaults.price')}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={price}
              maxLength={20}
              onChange={(event) => setPrice(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Compare-at price"
          hint="Optional. Must be higher than the price."
          error={compareProblem ?? firstError(errors, 'defaults.compareAt')}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={compareAt}
              maxLength={20}
              onChange={(event) => setCompareAt(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Weight (g)" hint="Optional.">
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={weightG}
              maxLength={6}
              onChange={(event) => setWeightG(event.target.value)}
            />
          )}
        </FormField>
      </fieldset>

      <div aria-live="polite" className="flex flex-col gap-2 border border-line bg-sunken p-4">
        <p className="type-admin font-medium text-fg">{describePreview(preview)}</p>
        {preview.problems.length > 0 ? (
          <ul className="list-disc pl-5 type-small text-fg-muted">
            {preview.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : (
          <p className="type-small text-fg-muted">
            {options.length === 0
              ? 'No options: the product has one variant. '
              : `${preview.total} ${preview.total === 1 ? 'combination' : 'combinations'} in total. `}
            Removed variants that have stock history are archived instead of deleted.
          </p>
        )}
      </div>

      {formError || serverMessages.length > 0 ? (
        <div role="alert" className="type-small text-danger-text">
          {formError ? <p>{formError}</p> : null}
          {serverMessages
            .filter((m) => m !== formError)
            .map((message) => (
              <p key={message}>{message}</p>
            ))}
        </div>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={!canSubmit} loading={pending && !confirming}>
          Generate variants
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove variants?"
        description={`${preview.remove} existing ${preview.remove === 1 ? 'variant is' : 'variants are'} not in the new matrix. Those with stock history are archived, the rest are deleted.`}
        confirmLabel="Generate and remove"
        danger
        pending={pending}
        onConfirm={() => void run()}
      />
    </form>
  );
}
