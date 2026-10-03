'use client';

import { useRouter } from 'next/navigation';
import { SingleImageField } from '@/components/admin/single-image-field';
import { removeCollectionHero, uploadCollectionHero } from '@/modules/catalog/actions';

interface CollectionHeroProps {
  collectionId: string;
  current: { url: string; alt: string } | null;
}

/** The collection's hero image, with required alt text. */
export function CollectionHero({ collectionId, current }: CollectionHeroProps) {
  const router = useRouter();
  return (
    <SingleImageField
      label="Hero image"
      current={current}
      fields={{ collectionId }}
      upload={uploadCollectionHero}
      remove={() => removeCollectionHero({ collectionId })}
      onChanged={() => router.refresh()}
    />
  );
}
