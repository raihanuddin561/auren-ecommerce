'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateProductDetails } from '@/modules/catalog/actions';
import type { ProductView } from './types';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { failureMessage, fieldErrorsOf, type FieldErrorMap } from '../../action-feedback';
import { FormSection, SaveStatusLine } from '../../form-section';
import {
  AUTOSAVE_DELAY_MS,
  detailsKey,
  formKey,
  saveStatusOf,
  shouldAutosave,
  toDetailsPayload,
  validateDetails,
  valuesFromProduct,
  type DetailsValues,
} from './details-state';
import { SelectField } from './select-field';
import { TagsInput } from './tags-input';

interface DetailsFormProps {
  product: ProductView;
  categories: Array<{ id: string; label: string }>;
  sizeCharts: Array<{ id: string; label: string }>;
  canWrite: boolean;
}

const FITS = [
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'relaxed', label: 'Relaxed' },
];

type TextKey = {
  [K in keyof DetailsValues]: DetailsValues[K] extends string ? K : never;
}[keyof DetailsValues];

/**
 * Product details with its own save. A draft saves itself 1.5 seconds after the last edit (only
 * when the form is changed and valid); an active or archived product waits for the Save button.
 * A failed save never clears the form.
 */
export function DetailsForm({ product, categories, sizeCharts, canWrite }: DetailsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<DetailsValues>(() => valuesFromProduct(product));
  const [savedKey, setSavedKey] = useState(() => detailsKey(valuesFromProduct(product)));
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);

  const currentKey = detailsKey(values);
  const dirty = currentKey !== savedKey;
  const localErrors = useMemo(() => validateDetails(product.id, values), [product.id, values]);
  const valid = Object.keys(localErrors).length === 0;
  const autosave = canWrite && product.status === 'draft';
  const errors: FieldErrorMap = { ...(dirty ? localErrors : {}), ...serverErrors };
  const err = (key: string): string | null => errors[key]?.[0] ?? null;

  function set<K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setServerErrors({});
    setFormError(null);
  }

  async function save(manual: boolean) {
    if (saving) return;
    if (!valid) {
      setFormError('Check the highlighted fields before saving.');
      return;
    }
    const key = currentKey;
    setSaving(true);
    setFormError(null);
    const result = await updateProductDetails(toDetailsPayload(product.id, values));
    setSaving(false);
    if (!result.ok) {
      const mapped: FieldErrorMap = {};
      for (const [path, messages] of Object.entries(fieldErrorsOf(result))) {
        mapped[formKey(path)] = messages;
      }
      setServerErrors(mapped);
      setFormError(failureMessage(result));
      setFailedKey(key);
      if (manual) toast.error('Details were not saved', failureMessage(result) ?? undefined);
      return;
    }
    setSavedKey(key);
    setFailedKey(null);
    setServerErrors({});
    if (manual) toast.success('Details saved');
    router.refresh();
  }

  // Debounced autosave. The timer restarts on every edit and stops while a save is running.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (!shouldAutosave({ enabled: autosave, dirty, valid, saving, failedKey, currentKey })) return;
    const timer = window.setTimeout(() => void saveRef.current(false), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autosave, dirty, valid, saving, failedKey, currentKey]);

  const text = (
    key: TextKey,
    label: string,
    extra: { hint?: string; max?: number; required?: boolean } = {},
  ) => (
    <FormField
      label={label}
      hint={
        extra.max
          ? `${extra.hint ? `${extra.hint} ` : ''}${values[key].length}/${extra.max}`
          : extra.hint
      }
      error={err(key)}
      required={extra.required}
    >
      {(control) => (
        <Input
          {...control}
          value={values[key]}
          maxLength={extra.max}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <FormSection
      title="Details"
      description={
        autosave
          ? 'Drafts save themselves a moment after you stop typing.'
          : 'Changes to a live or archived product are saved when you choose Save details.'
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
        className="flex flex-col gap-5"
      >
        <fieldset disabled={!canWrite} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <legend className="sr-only">Product details</legend>
          {text('title', 'Title', { required: true, max: 140 })}
          {text('subtitle', 'Subtitle', { max: 160 })}
          <div className="flex flex-col gap-1.5">
            {text('slug', 'Slug', {
              hint: 'Lowercase letters, numbers and hyphens.',
              required: true,
              max: 80,
            })}
            <p className="type-small text-fg-muted">
              Storefront address: <span className="text-fg">/products/{values.slug || '...'}</span>.
              Changing the slug of a live product creates a permanent redirect from the old address
              automatically.
            </p>
          </div>
          <FormField
            label="Description"
            hint={`Markdown is supported. ${values.description.length}/8000`}
            error={err('description')}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={8}
                maxLength={8000}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Category"
              value={values.categoryId}
              onChange={(value) => set('categoryId', value)}
              options={categories.map((c) => ({ value: c.id, label: c.label }))}
              noneLabel="None"
              hint="Needed before the product can go live."
              error={err('categoryId')}
            />
            <SelectField
              label="Size chart"
              value={values.sizeChartId}
              onChange={(value) => set('sizeChartId', value)}
              options={sizeCharts.map((c) => ({ value: c.id, label: c.label }))}
              noneLabel="None"
              hint="Attaches the size guide. Also configure matching sizes under 'Options and variants' below."
              error={err('sizeChartId')}
            />
            {text('productType', 'Product type', { max: 60 })}
            <SelectField
              label="Fit"
              value={values.fit}
              onChange={(value) => set('fit', value)}
              options={FITS}
              noneLabel="None"
              error={err('fit')}
            />
            {text('material', 'Material', { max: 200 })}
            {text('origin', 'Origin', { max: 60 })}
          </div>
          <FormField
            label="Care instructions"
            hint={`${values.careInstructions.length}/1000`}
            error={err('careInstructions')}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={1000}
                value={values.careInstructions}
                onChange={(event) => set('careInstructions', event.target.value)}
              />
            )}
          </FormField>
          <TagsInput
            tags={values.tags}
            onChange={(tags) => set('tags', tags)}
            error={err('tags')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {text('fabric', 'Fabric', { max: 60 })}
            {text('occasion', 'Occasion', { max: 60 })}
            {text('season', 'Season', { max: 60 })}
            {text('pattern', 'Pattern', { max: 60 })}
          </div>
          <FormField
            label="Featured rank"
            hint="Lower numbers come first in featured lists. Leave blank for none."
            error={err('featuredRank')}
            className="sm:max-w-xs"
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={values.featuredRank}
                maxLength={5}
                onChange={(event) => set('featuredRank', event.target.value)}
              />
            )}
          </FormField>
          <div className="grid gap-5">
            {text('seoTitle', 'SEO title', {
              hint: 'Shown in search results. Falls back to the title.',
              max: 70,
            })}
            <FormField
              label="SEO description"
              hint={`${values.seoDescription.length}/160`}
              error={err('seoDescription')}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  maxLength={160}
                  value={values.seoDescription}
                  onChange={(event) => set('seoDescription', event.target.value)}
                />
              )}
            </FormField>
          </div>
        </fieldset>
        {formError ? (
          <p role="alert" className="type-small text-danger-text">
            {formError}
          </p>
        ) : null}
        {canWrite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <SaveStatusLine status={saveStatusOf({ dirty, saving, failedKey, currentKey })} />
            <Button type="submit" size="sm" loading={saving} disabled={!dirty && !saving}>
              Save details
            </Button>
          </div>
        ) : (
          <p className="type-small text-fg-muted">
            You can view these details but not change them.
          </p>
        )}
      </form>
    </FormSection>
  );
}
