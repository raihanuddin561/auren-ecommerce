/**
 * The shapes these screens read. They mirror the DTOs of the catalogue queries (ProductDetail and
 * ProductListRow) field for field, so a page can pass the query result straight in. They live here
 * because components may not import from a module's queries file (layering rule).
 */

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface VariantView {
  id: string;
  sku: string;
  barcode: string | null;
  /** Decimal text for the form, e.g. "2490.00". */
  price: string;
  priceLabel: string;
  compareAt: string;
  weightG: number | null;
  status: ProductStatus;
  isDefault: boolean;
  labels: string[];
  optionValueIds: string[];
  onHand: number;
  reserved: number;
  available: number;
  hasCost: boolean;
  avgCost: string | null;
}

export interface OptionView {
  id: string;
  name: string;
  values: Array<{ id: string; value: string; label: string; swatchHex: string | null }>;
}

export interface MediaView {
  id: string;
  url: string;
  alt: string;
  optionValueId: string | null;
  width: number | null;
  height: number | null;
}

export interface ProductView {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  slug: string;
  status: ProductStatus;
  categoryId: string | null;
  sizeChartId: string | null;
  productType: string | null;
  material: string | null;
  careInstructions: string | null;
  fit: 'slim' | 'regular' | 'relaxed' | null;
  origin: string | null;
  tags: string[];
  attributes: { fabric: string; occasion: string; season: string; pattern: string };
  featuredRank: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  options: OptionView[];
  variants: VariantView[];
  media: MediaView[];
}

export interface ProductRowView {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  categoryName: string | null;
  variantCount: number;
  priceRange: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  updatedAt: Date;
}
