'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/action-result';
import { failureMessage, fieldErrorsOf, firstError } from './action-feedback';
import { shrinkForUpload } from './shrink-image';

interface SingleImageFieldProps {
  /** Heading for the field, for example "Category image". */
  label: string;
  current: { url: string; alt: string } | null;
  /** Receives FormData with `file` and `alt` already set, plus the `fields` below. */
  upload: (form: FormData) => Promise<ActionResult<unknown>>;
  remove: () => Promise<ActionResult<unknown>>;
  /** Extra hidden fields for the upload (for example categoryId). */
  fields: Record<string, string>;
  onChanged?: () => void;
}

/**
 * One image with its alt text. Alt text is required: the upload is refused without it, here and
 * on the server. Images go through the MediaProvider on the server (type, size and metadata are
 * checked there); the browser only previews the file.
 */
export function SingleImageField({
  label,
  current,
  upload,
  remove,
  fields,
  onChanged,
}: SingleImageFieldProps) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const alt = String(form.get('alt') ?? '').trim();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return setErrors({ file: ['Choose an image.'] });
    }
    if (alt === '') return setErrors({ alt: ['Describe the image (alt text is required)'] });
    setPending(true);
    setErrors({});
    let result: ActionResult<unknown>;
    try {
      form.set('file', await shrinkForUpload(file));
      result = await upload(form);
    } catch {
      setPending(false);
      return void toast.error('The image could not be sent. Check your connection and try again.');
    }
    setPending(false);
    if (!result.ok) {
      setErrors(fieldErrorsOf(result));
      toast.error(failureMessage(result) ?? 'The image could not be saved.');
      return;
    }
    formRef.current?.reset();
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    toast.success('Image saved');
    onChanged?.();
  }

  async function onRemove() {
    setPending(true);
    const result = await remove();
    setPending(false);
    if (!result.ok) {
      return void toast.error(failureMessage(result) ?? 'The image could not be removed.');
    }
    toast.success('Image removed');
    onChanged?.();
  }

  const shown = preview ?? current?.url ?? null;
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="type-small font-medium text-fg">{label}</legend>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or an already optimised upload
        <img
          src={shown}
          alt={preview ? 'Preview of the chosen image' : (current?.alt ?? '')}
          className="aspect-[4/5] w-40 border border-line object-cover"
        />
      ) : null}
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Image file"
          hint="JPEG, PNG, WebP or AVIF, up to 10 MB."
          error={firstError(errors, 'file')}
        >
          {(control) => (
            <Input
              {...control}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (preview) URL.revokeObjectURL(preview);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          )}
        </FormField>
        <FormField
          label="Alt text"
          hint="Describe the image for people who cannot see it."
          error={firstError(errors, 'alt')}
          required
        >
          {(control) => <Input {...control} name="alt" maxLength={200} defaultValue="" />}
        </FormField>
        <div className="flex gap-3">
          <Button type="submit" size="sm" loading={pending}>
            {current ? 'Replace image' : 'Upload image'}
          </Button>
          {current ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onRemove}
              disabled={pending}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </fieldset>
  );
}
