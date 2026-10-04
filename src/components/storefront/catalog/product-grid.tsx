import { cn } from '@/lib/cn';
import { gridColumnClasses, type Density } from '@/modules/catalog/listing';
import { ProductCard, ProductCardSkeleton, type ProductCardView } from './product-card';

interface ProductGridProps {
  products: ProductCardView[];
  /** Accessible name of the list. */
  label: string;
  /** How many leading cards load eagerly (the row above the fold). Zero for sections lower down. */
  priorityCount?: number;
  /** Chosen grid density; omit for the default two columns on a phone and four on desktop. */
  density?: Density | null;
  /** Image `sizes` hint that matches the density. */
  sizes?: string;
  className?: string;
}

/** Two columns on a phone, four on a desktop, unless the visitor picked another density. */
export function ProductGrid({
  products,
  label,
  priorityCount = 0,
  density = null,
  sizes,
  className,
}: ProductGridProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'grid gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14',
        gridColumnClasses(density),
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} sizes={sizes} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({
  count = 4,
  density = null,
}: {
  count?: number;
  density?: Density | null;
}) {
  return (
    <div className={cn('grid gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14', gridColumnClasses(density))}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
