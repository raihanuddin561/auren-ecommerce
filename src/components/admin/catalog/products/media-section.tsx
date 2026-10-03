import type { ProductView } from './types';
import { FormSection } from '../../form-section';
import { MediaGallery } from './media-gallery';
import { MediaUploader } from './media-uploader';
import { isColourOption } from './variant-preview';

interface MediaSectionProps {
  product: ProductView;
  canWrite: boolean;
}

/** Images: the existing ones (reorder, describe, delete) and the multi-file uploader. */
export function MediaSection({ product, canWrite }: MediaSectionProps) {
  const colourOption = product.options.find((option) => isColourOption(option.name));
  const colours = (colourOption?.values ?? []).map((v) => ({ id: v.id, label: v.label }));
  return (
    <FormSection
      title="Images"
      description="Every image needs alt text. Link an image to a colour so shoppers see it when they pick that colour."
    >
      <MediaGallery
        productId={product.id}
        media={product.media}
        colours={colours}
        canWrite={canWrite}
      />
      {canWrite ? (
        <MediaUploader
          productId={product.id}
          existingCount={product.media.length}
          colours={colours}
        />
      ) : null}
    </FormSection>
  );
}
