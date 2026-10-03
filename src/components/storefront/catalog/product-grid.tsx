import { cn } from '@/lib/cn';
import { ProductCard, ProductCardSkeleton, type ProductCardView } from './product-card';

interface ProductGridProps {
  products: ProductCardView[];
  /** Accessible name of the list. */
  label: string;
  /** How many leading cards load eagerly (the row above the fold). Zero for sections lower down. */
  priorityCount?: number;
  className?: string;
}

/** Two columns on a phone, four on a desktop. */
export function ProductGrid({ products, label, priorityCount = 0, className }: ProductGridProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6 md:gap-y-14',
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6 md:gap-y-14">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
