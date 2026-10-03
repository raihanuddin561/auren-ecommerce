'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { FormActions, FormSection, type SaveStatus } from '@/components/admin/form-section';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { createCategory, updateCategory } from '@/modules/catalog/actions';
import { parentOptions, previewCategoryPath, type CategoryRow } from './tree';

/** Radix Select items cannot have an empty value, so "no parent" uses a sentinel. */
const NO_PARENT = '__none';
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 160;
const DESCRIPTION_MAX = 1000;

export interface CategoryFormValues {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface CategoryFormProps {
  /** Present when editing. */
  category?: CategoryFormValues;
  /** The whole tree, used for the parent choices and the address preview. */
  rows: CategoryRow[];
  canWrite: boolean;
  /** A parent preselected when creating from the list page. */
  initialParentId?: string | null;
}

const counter = (length: number, max: number) =>
  length > max
    ? `${length} of ${max} characters. This is too long.`
    : `${length} of ${max} characters.`;

export function CategoryForm({ category, rows, canWrite, initialParentId }: CategoryFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveStatus | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [parent, setParent] = useState(category?.parentId ?? initialParentId ?? NO_PARENT);
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [seoTitle, setSeoTitle] = useState(category?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(category?.seoDescription ?? '');

  const touch = () => setStatus((current) => (current === 'saving' ? current : 'dirty'));

  const options = parentOptions(rows, category?.id ?? null);
  const parentPath = options.find((option) => option.id === parent)?.path ?? null;
  const preview = previewCategoryPath(parentPath, slug, name);
  // A new address (slug or parent changed) on a live category gets a permanent redirect.
  const addressChanged =
    category !== undefined &&
    category.isActive &&
    preview !== null &&
    preview !== `/shop/${category.path}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setErrors({});
    setFormError(null);
    setStatus('saving');
    const payload = {
      ...(category ? { id: category.id } : {}),
      name,
      slug,
      parentId: parent === NO_PARENT ? null : parent,
      description,
      isActive,
      seoTitle,
      seoDescription,
    };
    startTransition(async () => {
      const result = category ? await updateCategory(payload) : await createCategory(payload);
      if (!result.ok) {
        const fieldErrors = fieldErrorsOf(result);
        const general = Object.keys(fieldErrors).length === 0 || Boolean(fieldErrors['_form']);
        setErrors(fieldErrors);
        setFormError(general ? failureMessage(result) : null);
        setStatus('error');
        toast.error(failureMessage(result) ?? 'The category could not be saved.');
        return;
      }
      setStatus('saved');
      if (category) {
        toast.success('Category saved');
        router.refresh();
      } else {
        toast.success('Category created');
        router.push('/admin/categories');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label={category ? 'Edit category' : 'New category'}>
      <fieldset disabled={!canWrite || pending} className="flex flex-col gap-6 border-0 p-0">
        <legend className="sr-only">Category details</legend>
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
          description="The name shoppers see, and where the category sits in the menu."
        >
          <FormField
            label="Name"
            required
            error={firstError(errors, 'name')}
            hint="Up to 80 characters."
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
            label="Parent category"
            error={firstError(errors, 'parentId')}
            hint="Categories can be nested three levels deep."
          >
            {(control) => (
              <Select
                value={parent}
                onValueChange={(value) => {
                  setParent(value);
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
                  <SelectItem value={NO_PARENT}>None (top level)</SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id} disabled={option.disabled}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Slug"
            error={firstError(errors, 'slug')}
            hint="Leave blank to use the name. Lowercase letters, numbers and single hyphens."
          >
            {(control) => (
              <Input
                {...control}
                name="slug"
                value={slug}
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setSlug(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
          <p className="-mt-3 type-small text-fg-muted">
            Address on the storefront:{' '}
            <span className="font-medium break-all text-fg">
              {preview ?? 'add a name to see the address'}
            </span>
          </p>
          {addressChanged ? (
            <p role="status" className="-mt-2 type-small text-fg-muted">
              Old links keep working: we add a permanent redirect.
            </p>
          ) : null}

          <FormField
            label="Description"
            error={firstError(errors, 'description')}
            hint={counter(description.length, DESCRIPTION_MAX)}
          >
            {(control) => (
              <Textarea
                {...control}
                name="description"
                value={description}
                rows={4}
                onChange={(event) => {
                  setDescription(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>

          <div>
            <Switch
              label={isActive ? 'Active: shown on the storefront' : 'Hidden from the storefront'}
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked);
                touch();
              }}
            />
            {errors['isActive'] ? (
              <p role="alert" className="type-small text-danger-text">
                {firstError(errors, 'isActive')}
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection
          title="Search appearance"
          description="How the category shows in search results. Leave blank to use the name and description."
        >
          <FormField
            label="SEO title"
            error={firstError(errors, 'seoTitle')}
            hint={counter(seoTitle.length, SEO_TITLE_MAX)}
          >
            {(control) => (
              <Input
                {...control}
                name="seoTitle"
                value={seoTitle}
                autoComplete="off"
                onChange={(event) => {
                  setSeoTitle(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
          <FormField
            label="SEO description"
            error={firstError(errors, 'seoDescription')}
            hint={counter(seoDescription.length, SEO_DESCRIPTION_MAX)}
          >
            {(control) => (
              <Textarea
                {...control}
                name="seoDescription"
                value={seoDescription}
                rows={3}
                onChange={(event) => {
                  setSeoDescription(event.target.value);
                  touch();
                }}
              />
            )}
          </FormField>
        </FormSection>
      </fieldset>

      {canWrite ? (
        <FormActions status={status}>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/categories">Cancel</Link>
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </FormActions>
      ) : (
        <p className="mt-6 type-admin text-fg-muted">
          You can view this category but not change it.
        </p>
      )}
    </form>
  );
}
