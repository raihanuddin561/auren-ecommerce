'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  deleteProductMedia,
  reorderProductMedia,
  updateProductMedia,
} from '@/modules/catalog/actions';
import type { ProductView } from './types';
import { Badge } from '@/components/ui/badge';
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
import { SortableList } from '../../sortable-list';
import { ConfirmDialog } from './confirm-dialog';
import type { ColourChoice } from './media-uploader';
import { SelectField } from './select-field';
import { fromSelect, toSelect } from './select-value';

type Media = ProductView['media'][number];

interface MediaCardProps {
  media: Media;
  primary: boolean;
  colours: ColourChoice[];
  canWrite: boolean;
  onChanged: () => void;
}

function MediaCard({ media, primary, colours, canWrite, onChanged }: MediaCardProps) {
  const [alt, setAlt] = useState(media.alt);
  const [colour, setColour] = useState(toSelect(media.optionValueId));
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const changed = alt !== media.alt || colour !== toSelect(media.optionValueId);

  async function update() {
    setSaving(true);
    setErrors({});
    const result = await updateProductMedia({
      id: media.id,
      alt,
      optionValueId: fromSelect(colour),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(fieldErrorsOf(result));
      toast.error('Image was not updated', failureMessage(result) ?? undefined);
      return;
    }
    toast.success('Image updated');
    onChanged();
  }

  async function remove() {
    setDeleting(true);
    const result = await deleteProductMedia({ id: media.id });
    setDeleting(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error('Image was not deleted', failureMessage(result) ?? undefined);
      return;
    }
    toast.success('Image deleted');
    onChanged();
  }

  return (
    <div className="flex flex-col">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- already optimised at upload */}
        <img
          src={media.url}
          alt={media.alt}
          width={media.width ?? 400}
          height={media.height ?? 500}
          loading="lazy"
          draggable={false}
          className="aspect-[4/5] w-full object-cover"
        />
        {primary ? (
          <Badge tone="ink" className="absolute top-2 left-2">
            Primary
          </Badge>
        ) : null}
      </div>
      <fieldset disabled={!canWrite} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-3">
        <FormField label="Alt text" required error={firstError(errors, 'alt')}>
          {(control) => (
            <Input
              {...control}
              value={alt}
              maxLength={200}
              className="h-10 px-3 type-admin"
              onChange={(event) => setAlt(event.target.value)}
            />
          )}
        </FormField>
        {colours.length > 0 ? (
          <SelectField
            label="Colour"
            value={colour}
            onChange={setColour}
            options={colours.map((c) => ({ value: c.id, label: c.label }))}
            noneLabel="No colour"
            error={firstError(errors, 'optionValueId')}
          />
        ) : null}
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={!changed || alt.trim() === ''}
              onClick={() => void update()}
            >
              Update
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </fieldset>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this image?"
        description={
          primary
            ? 'This is the primary image. The next image becomes the primary one. Deleting cannot be undone.'
            : 'Deleting cannot be undone.'
        }
        confirmLabel="Delete image"
        danger
        pending={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

interface MediaGalleryProps {
  productId: string;
  media: ProductView['media'];
  colours: ColourChoice[];
  canWrite: boolean;
}

/** The product's images in order. The first one is the primary image shoppers see in lists. */
export function MediaGallery({ productId, media, colours, canWrite }: MediaGalleryProps) {
  const router = useRouter();
  const serverOrder = media.map((m) => m.id).join('|');
  const [seen, setSeen] = useState(serverOrder);
  const [order, setOrder] = useState(() => media.map((m) => m.id));
  // Follow the server after a refresh (adjusting state during render, not in an effect).
  if (seen !== serverOrder) {
    setSeen(serverOrder);
    setOrder(media.map((m) => m.id));
  }

  const byId = new Map(media.map((m) => [m.id, m]));
  const items = order
    .map((id) => byId.get(id))
    .filter((m): m is Media => m !== undefined)
    .map((m, index) => ({
      id: m.id,
      label: m.alt || `image ${index + 1}`,
      content: (
        <MediaCard
          media={m}
          primary={index === 0}
          colours={colours}
          canWrite={canWrite}
          onChanged={() => router.refresh()}
        />
      ),
    }));

  async function onReorder(orderedIds: string[]): Promise<boolean> {
    const previous = order;
    setOrder(orderedIds);
    const result = await reorderProductMedia({ productId, orderedIds });
    if (!result.ok) {
      setOrder(previous);
      toast.error('The order was not saved', failureMessage(result) ?? undefined);
      return false;
    }
    router.refresh();
    return true;
  }

  if (media.length === 0) {
    return (
      <p className="border border-line bg-sunken p-4 type-admin text-fg-muted">
        No images yet. The first image you upload becomes the primary image shoppers see in lists. A
        product needs at least one image before it can go live.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="type-small text-fg-muted">
        {canWrite
          ? 'Drag an image, or use the earlier and later buttons, to change the order. The first image is the primary image.'
          : 'The first image is the primary image.'}
      </p>
      <SortableList
        layout="grid"
        label="Product images"
        items={items}
        disabled={!canWrite}
        onReorder={onReorder}
      />
    </div>
  );
}
