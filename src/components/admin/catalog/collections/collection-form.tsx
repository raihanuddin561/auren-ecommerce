'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducer, useState, type FormEvent } from 'react';
import { failureMessage, firstError, type FieldErrorMap } from '@/components/admin/action-feedback';
import { FormActions, FormSection, type SaveStatus } from '@/components/admin/form-section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { createCollection, updateCollection } from '@/modules/catalog/actions';
import {
  buildPayload,
  resolvePublishedAt,
  slugPreview,
  SORT_OPTIONS,
  type CollectionFormValues,
  type CollectionSortValue,
  type CollectionTypeValue,
  type PublishMode,
} from './form-state';
import { RulesEditor, type CategoryOption } from './rules-editor';
import { cleanRules, rulesReducer } from './rules-state';

type PublishState = 'draft' | 'scheduled' | 'live';
type FormFields = Omit<CollectionFormValues, 'rules'>;

/** Comparable text of the editable state, used to tell whether anything changed. */
const snapshotOf = (fields: FormFields, rules: CollectionFormValues['rules']): string =>
  JSON.stringify({ fields, rules: cleanRules(rules) });

function When({ iso }: { iso: string }) {
  // Shown in the reader's own time zone, so server and browser text can differ.
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </time>
  );
}

interface CollectionFormProps {
  /** Present when editing a saved collection. */
  collectionId?: string;
  initial: CollectionFormValues;
  /** The saved publish date (ISO), when the collection is scheduled or live. */
  savedPublishedAt: string | null;
  savedState: PublishState;
  categories: CategoryOption[];
  canWrite: boolean;
  canPublish: boolean;
}

const stateOf = (iso: string | null): PublishState =>
  iso === null ? 'draft' : new Date(iso).getTime() > Date.now() ? 'scheduled' : 'live';

const TYPE_DESCRIPTION: Record<CollectionTypeValue, string> = {
  manual: 'You choose the products and put them in order.',
  automatic:
    'Products that match your rules join on their own. Saving replaces a hand-picked list (the old list stays in the audit log).',
};

export function CollectionForm({
  collectionId,
  initial,
  savedPublishedAt,
  savedState,
  categories,
  canWrite,
  canPublish,
}: CollectionFormProps) {
  const router = useRouter();
  const { rules: initialRules, ...initialFields } = initial;
  const [values, setValues] = useState<FormFields>(initialFields);
  const [rules, dispatchRules] = useReducer(rulesReducer, initialRules);
  const [saved, setSaved] = useState({
    id: collectionId ?? null,
    publishedAt: savedPublishedAt,
    state: savedState,
    snapshot: snapshotOf(initialFields, initialRules),
    rules: JSON.stringify(cleanRules(initialRules)),
  });
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [failed, setFailed] = useState(false);

  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const current: CollectionFormValues = { ...values, rules };
  const dirty = snapshotOf(values, rules) !== saved.snapshot;
  const rulesChanged = JSON.stringify(cleanRules(rules)) !== saved.rules;
  const isEdit = saved.id !== null;
  const automatic = values.type === 'automatic';

  // Any date needs the publish permission, including saving a collection that is already live.
  const needsPublish = values.publishMode !== 'draft';
  const blockedByPublish = needsPublish && !canPublish;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canWrite || blockedByPublish) return;
    setErrors({});
    setFailed(false);

    const resolved = resolvePublishedAt(current, {
      savedPublishedAt: saved.publishedAt,
      now: new Date(),
    });
    if (!resolved.ok) {
      setErrors({ publishedAt: [resolved.message] });
      return;
    }

    const payload = buildPayload(current, resolved.publishedAt);
    setPending(true);
    const result = saved.id
      ? await updateCollection({ id: saved.id, ...payload })
      : await createCollection(payload);
    setPending(false);

    if (!result.ok) {
      setFailed(true);
      setErrors({
        ...(result.error.fieldErrors ?? {}),
        ...(result.error.fieldErrors ? {} : { _form: [failureMessage(result) ?? ''] }),
      });
      toast.error(failureMessage(result) ?? 'The collection could not be saved.');
      return;
    }

    toast.success(saved.id ? 'Collection saved' : 'Collection created');
    if (!saved.id) {
      router.push(`/admin/collections/${result.data.id}`);
      return;
    }
    const nextMode: PublishMode = resolved.publishedAt ? 'keep' : 'draft';
    const next: FormFields = {
      ...values,
      slug: result.data.slug,
      publishMode: nextMode,
      scheduledAt: '',
    };
    setValues(next);
    setSaved({
      id: saved.id,
      publishedAt: resolved.publishedAt,
      state: stateOf(resolved.publishedAt),
      snapshot: snapshotOf(next, rules),
      rules: JSON.stringify(cleanRules(rules)),
    });
    router.refresh();
  }

  const status: SaveStatus = pending ? 'saving' : failed ? 'error' : dirty ? 'dirty' : 'saved';
  const address = slugPreview(values.title, values.slug);
  const formError = firstError(errors, '_form');

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={!canWrite || pending} className="contents">
        <legend className="sr-only">Collection details</legend>

        <FormSection title="Details" description="What shoppers see on the collection page.">
          <FormField label="Title" required error={firstError(errors, 'title')}>
            {(control) => (
              <Input
                {...control}
                name="title"
                value={values.title}
                maxLength={100}
                autoComplete="off"
                onChange={(event) => set('title', event.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Slug"
            hint={
              saved.state === 'live'
                ? 'Changing the slug of a live collection creates a permanent redirect from the old address.'
                : 'Leave blank to use the title. Lowercase letters, numbers and hyphens.'
            }
            error={firstError(errors, 'slug')}
          >
            {(control) => (
              <>
                <Input
                  {...control}
                  name="slug"
                  value={values.slug}
                  maxLength={80}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => set('slug', event.target.value)}
                />
                <p className="type-small text-fg-muted">
                  Address:{' '}
                  <span className="font-mono break-all text-fg">
                    {address ? `/collections/${address}` : '/collections/'}
                  </span>
                </p>
              </>
            )}
          </FormField>

          <FormField
            label="Description"
            hint="Shown at the top of the collection page."
            error={firstError(errors, 'description')}
          >
            {(control) => (
              <Textarea
                {...control}
                name="description"
                value={values.description}
                maxLength={2000}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection
          title="Products"
          description="Choose how products get into this collection and how they are ordered."
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="type-small font-medium text-fg">Collection type</legend>
            <RadioGroup
              value={values.type}
              onValueChange={(value) => set('type', value === 'automatic' ? 'automatic' : 'manual')}
              aria-label="Collection type"
            >
              <RadioItem value="manual" label="Manual" description={TYPE_DESCRIPTION.manual} />
              <RadioItem
                value="automatic"
                label="Automatic"
                description={TYPE_DESCRIPTION.automatic}
              />
            </RadioGroup>
          </fieldset>

          {automatic ? (
            <RulesEditor
              rules={rules}
              dispatch={dispatchRules}
              categories={categories}
              errors={errors}
              collectionId={saved.id}
              rulesChanged={rulesChanged}
              disabled={!canWrite || pending}
            />
          ) : null}

          <FormField
            label="Sort order"
            hint={
              automatic
                ? 'Automatic collections are usually sorted by a rule such as newest.'
                : 'Manual order follows the list you arrange below.'
            }
            error={firstError(errors, 'sortOrder')}
          >
            {(control) => (
              <Select
                value={values.sortOrder}
                onValueChange={(value) => set('sortOrder', value as CollectionSortValue)}
              >
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <Switch
            checked={values.isFeatured}
            onCheckedChange={(checked) => set('isFeatured', checked)}
            label="Featured on the home page"
          />
        </FormSection>

        <FormSection
          title="Publishing"
          description="A collection stays out of the shop until it is published."
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="type-small font-medium text-fg">Visibility</legend>
            <RadioGroup
              value={values.publishMode}
              onValueChange={(value) => set('publishMode', value as PublishMode)}
              aria-label="Visibility"
            >
              <RadioItem
                value="draft"
                label="Draft"
                description="Not visible in the shop. Take a live collection offline by choosing this."
              />
              {saved.publishedAt ? (
                <RadioItem
                  value="keep"
                  disabled={!canPublish}
                  label={
                    <>
                      {saved.state === 'live' ? 'Live since ' : 'Scheduled for '}
                      <When iso={saved.publishedAt} />
                    </>
                  }
                  description="Keep the current publish date."
                />
              ) : null}
              <RadioItem
                value="now"
                disabled={!canPublish}
                label="Publish now"
                description="Visible in the shop as soon as you save."
              />
              <RadioItem
                value="schedule"
                disabled={!canPublish}
                label="Schedule"
                description="Goes live on its own at the time you choose."
              />
            </RadioGroup>
          </fieldset>

          {values.publishMode === 'schedule' ? (
            <FormField
              label="Publish at"
              hint="Uses the time zone of this device."
              error={firstError(errors, 'publishedAt')}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  name="scheduledAt"
                  value={values.scheduledAt}
                  onChange={(event) => set('scheduledAt', event.target.value)}
                />
              )}
            </FormField>
          ) : firstError(errors, 'publishedAt') ? (
            <p role="alert" className="type-small text-danger-text">
              {firstError(errors, 'publishedAt')}
            </p>
          ) : null}

          {!canPublish ? (
            <p className="type-small text-fg-muted">
              Publishing, scheduling and saving a live collection need the publish permission. Ask
              an owner or choose Draft.
            </p>
          ) : null}
        </FormSection>

        <FormSection
          title="Search appearance"
          description="How the collection appears in search results. Leave blank to use the title and description."
        >
          <FormField
            label="SEO title"
            hint={`${values.seoTitle.length} of 70 characters`}
            error={firstError(errors, 'seoTitle')}
          >
            {(control) => (
              <Input
                {...control}
                name="seoTitle"
                value={values.seoTitle}
                maxLength={70}
                autoComplete="off"
                onChange={(event) => set('seoTitle', event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="SEO description"
            hint={`${values.seoDescription.length} of 160 characters`}
            error={firstError(errors, 'seoDescription')}
          >
            {(control) => (
              <Textarea
                {...control}
                name="seoDescription"
                rows={3}
                value={values.seoDescription}
                maxLength={160}
                onChange={(event) => set('seoDescription', event.target.value)}
              />
            )}
          </FormField>
        </FormSection>
      </fieldset>

      {formError ? (
        <p role="alert" className="type-admin text-danger-text">
          {formError}
        </p>
      ) : null}

      {canWrite ? (
        <FormActions status={isEdit ? status : undefined}>
          {blockedByPublish ? (
            <p className="type-small text-fg-muted">Choose Draft, or ask for publish permission.</p>
          ) : null}
          <Button variant="ghost" asChild>
            <Link href="/admin/collections">Cancel</Link>
          </Button>
          <Button type="submit" loading={pending} disabled={blockedByPublish}>
            {isEdit ? 'Save changes' : 'Create collection'}
          </Button>
        </FormActions>
      ) : (
        <p className="type-admin text-fg-muted">You can view this collection but not change it.</p>
      )}
    </form>
  );
}
