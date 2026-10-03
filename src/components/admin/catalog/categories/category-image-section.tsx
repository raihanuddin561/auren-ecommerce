'use client';

import { useRouter } from 'next/navigation';
import { FormSection } from '@/components/admin/form-section';
import { SingleImageField } from '@/components/admin/single-image-field';
import { removeCategoryImage, uploadCategoryImage } from '@/modules/catalog/actions';

interface CategoryImageSectionProps {
  categoryId: string;
  image: { url: string; alt: string } | null;
}

/** The category picture, saved on its own (separate from the details form). */
export function CategoryImageSection({ categoryId, image }: CategoryImageSectionProps) {
  const router = useRouter();
  return (
    <FormSection
      title="Image"
      description="Shown on the category tile and page. Portrait images (4:5) look best."
    >
      <SingleImageField
        label="Category image"
        current={image}
        fields={{ categoryId }}
        upload={uploadCategoryImage}
        remove={() => removeCategoryImage({ categoryId })}
        onChanged={() => router.refresh()}
      />
    </FormSection>
  );
}
