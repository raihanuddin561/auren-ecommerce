import type { ProductView } from './types';

export type ProductStatus = ProductView['status'];

export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export interface ReadinessItem {
  id: 'variant' | 'image' | 'category';
  label: string;
  met: boolean;
}

/** The three things the server insists on before a product can go live, from the loaded data. */
export function publishReadiness(
  product: Pick<ProductView, 'variants' | 'media' | 'categoryId'>,
): ReadinessItem[] {
  const active = product.variants.filter((v) => v.status === 'active');
  // Price strings are decimal text: "0", "0.00" and "" all mean no price.
  const priced = active.length > 0 && active.every((v) => /[1-9]/.test(v.price));
  return [
    { id: 'variant', label: 'At least one active variant with a price', met: priced },
    { id: 'image', label: 'At least one image', met: product.media.length > 0 },
    { id: 'category', label: 'A category', met: product.categoryId !== null },
  ];
}

export const isReadyToPublish = (items: readonly ReadinessItem[]): boolean =>
  items.every((item) => item.met);
