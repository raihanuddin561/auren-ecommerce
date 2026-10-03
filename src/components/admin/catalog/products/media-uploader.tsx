'use client';

import { ImagePlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { uploadProductMedia } from '@/modules/catalog/actions';
import { shrinkForUpload } from '../../shrink-image';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { failureMessage, fieldErrorsOf } from '../../action-feedback';
import {
  ACCEPT_ATTRIBUTE,
  MAX_MEDIA_PER_PRODUCT,
  canUpload,
  selectFiles,
  type PendingState,
} from './media-files';
import { SelectField } from './select-field';
import { NONE, fromSelect } from './select-value';

export interface ColourChoice {
  id: string;
  label: string;
}

interface PendingFile {
  key: string;
  file: File;
  previewUrl: string;
  alt: string;
  colour: string;
  state: PendingState;
  error: string | null;
}

interface MediaUploaderProps {
  productId: string;
  existingCount: number;
  colours: ColourChoice[];
}

let counter = 0;

/**
 * Chooses or drops several images, asks for alt text on each, and uploads them one after another so
 * each file shows its own state and its own error. The server checks type, size and content.
 */
export function MediaUploader({ productId, existingCount, colours }: MediaUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);

  // Preview URLs are revoked when a card goes away and when the screen closes.
  const urls = useRef(new Map<string, string>());
  useEffect(() => {
    const held = urls.current;
    return () => {
      for (const url of held.values()) URL.revokeObjectURL(url);
      held.clear();
    };
  }, []);

  const room = MAX_MEDIA_PER_PRODUCT - existingCount - pending.length;

  function addFiles(list: FileList | File[]) {
    const { accepted, rejected } = selectFiles([...list], existingCount, pending.length);
    setNotices(rejected.map((r) => `${r.name}: ${r.reason}`));
    if (accepted.length === 0) return;
    const added = accepted.map((file): PendingFile => {
      counter += 1;
      const key = `file-${counter}`;
      const previewUrl = URL.createObjectURL(file);
      urls.current.set(key, previewUrl);
      return { key, file, previewUrl, alt: '', colour: NONE, state: 'ready', error: null };
    });
    setPending((current) => [...current, ...added]);
  }

  function discard(key: string) {
    const url = urls.current.get(key);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(key);
    setPending((current) => current.filter((p) => p.key !== key));
  }

  function patch(key: string, change: Partial<PendingFile>) {
    setPending((current) => current.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  async function uploadAll() {
    setRunning(true);
    let succeeded = 0;
    let failed = 0;
    for (const item of pending.filter((p) => p.state === 'ready' || p.state === 'error')) {
      patch(item.key, { state: 'uploading', error: null });
      const form = new FormData();
      form.set('productId', productId);
      form.set('alt', item.alt.trim());
      const optionValueId = fromSelect(item.colour);
      if (optionValueId) form.set('optionValueId', optionValueId);
      form.set('file', await shrinkForUpload(item.file));
      try {
        const result = await uploadProductMedia(form);
        if (result.ok) {
          succeeded += 1;
          discard(item.key);
        } else {
          failed += 1;
          const fields = fieldErrorsOf(result);
          const message =
            fields.file?.[0] ??
            fields.alt?.[0] ??
            fields.optionValueId?.[0] ??
            failureMessage(result);
          patch(item.key, { state: 'error', error: message });
        }
      } catch {
        failed += 1;
        patch(item.key, {
          state: 'error',
          error:
            'The upload was interrupted. The image may be too large or the connection dropped.',
        });
      }
    }
    setRunning(false);
    if (succeeded > 0) {
      toast.success(
        succeeded === 1 ? 'Image uploaded' : `${succeeded} images uploaded`,
        failed > 0 ? `${failed} could not be uploaded.` : undefined,
      );
      router.refresh();
    } else if (failed > 0) {
      toast.error('No images were uploaded', 'Each image shows what went wrong.');
    }
  }

  const waiting = pending.filter((p) => p.state === 'ready' || p.state === 'error').length;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Add images"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 border border-dashed border-line-strong px-6 py-8 text-center transition-auren-fast',
          dragOver && 'border-gold bg-sunken',
        )}
      >
        <Icon icon={ImagePlus} size={28} className="text-fg-muted" />
        <p className="type-admin text-fg">Drop images here, or choose them from your device.</p>
        <p className="type-small text-fg-muted">
          JPEG, PNG, WebP or AVIF, up to 10 MB each. {Math.max(0, room)} more allowed (limit{' '}
          {MAX_MEDIA_PER_PRODUCT}).
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChoose}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={room <= 0 || running}
          onClick={() => inputRef.current?.click()}
        >
          Choose images
        </Button>
      </div>

      {notices.length > 0 ? (
        <ul role="alert" className="list-disc pl-5 type-small text-danger-text">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <>
          <ul aria-label="Images waiting to upload" className="grid gap-4 sm:grid-cols-2">
            {pending.map((item) => (
              <li key={item.key} className="flex gap-4 border border-line bg-raised p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen file */}
                <img
                  src={item.previewUrl}
                  alt={item.alt.trim() || `Preview of ${item.file.name}`}
                  width={96}
                  height={120}
                  className="aspect-[4/5] w-24 shrink-0 border border-line object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate type-small text-fg-muted">{item.file.name}</p>
                    <button
                      type="button"
                      aria-label={`Remove ${item.file.name} from the upload`}
                      disabled={item.state === 'uploading'}
                      onClick={() => discard(item.key)}
                      className="inline-flex size-9 shrink-0 items-center justify-center text-fg-muted hover:text-fg disabled:opacity-40"
                    >
                      <Icon icon={X} size={16} />
                    </button>
                  </div>
                  <FormField label="Alt text" required hint="Describe the image.">
                    {(control) => (
                      <Input
                        {...control}
                        value={item.alt}
                        maxLength={200}
                        disabled={item.state === 'uploading'}
                        onChange={(event) => patch(item.key, { alt: event.target.value })}
                      />
                    )}
                  </FormField>
                  {colours.length > 0 ? (
                    <SelectField
                      label="Colour"
                      value={item.colour}
                      onChange={(value) => patch(item.key, { colour: value })}
                      options={colours.map((c) => ({ value: c.id, label: c.label }))}
                      noneLabel="No colour"
                    />
                  ) : null}
                  <p
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'flex items-center gap-2 type-small',
                      item.state === 'error' ? 'text-danger-text' : 'text-fg-muted',
                    )}
                  >
                    {item.state === 'uploading' ? <Spinner /> : null}
                    {item.state === 'uploading'
                      ? 'Uploading'
                      : item.state === 'error'
                        ? (item.error ?? 'Could not upload.')
                        : item.alt.trim()
                          ? 'Ready to upload'
                          : 'Add alt text to upload'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              loading={running}
              disabled={!canUpload(pending)}
              onClick={() => void uploadAll()}
            >
              {running ? 'Uploading' : `Upload ${waiting} ${waiting === 1 ? 'image' : 'images'}`}
            </Button>
            {!canUpload(pending) && !running ? (
              <p className="type-small text-fg-muted">Every image needs alt text before upload.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
