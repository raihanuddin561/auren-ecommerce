import Link from 'next/link';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize, type SerializedMoney } from '@/lib/money';
import { CatalogImage, ImagePlaceholder, isLocalImage } from './catalog-image';

/** What a card needs. Matches the catalogue's card data, which is serialisable across the server boundary. */
export interface ProductCardView {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  price: SerializedMoney;
  compareAt: SerializedMoney | null;
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  hoverImage: { url: string; alt: string } | null;
}

interface ProductCardProps {
  product: ProductCardView;
  /** Responsive sizes hint for the image. */
  sizes?: string;
  /** Set for the first row above the fold only. */
  priority?: boolean;
  className?: string;
}

export const CARD_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw';

/**
 * A product in a grid: 4:5 image, a second image on hover and keyboard focus (pointer devices
 * only, handled in CSS), then category, name and price. The whole card is one link.
 */
export function ProductCard({
  product,
  sizes = CARD_SIZES,
  priority = false,
  className,
}: ProductCardProps) {
  const { image, hoverImage } = product;
  // The second image is a convenience, so it is only shown when it can be loaded the same way.
  const swap = hoverImage && isLocalImage(hoverImage.url) ? hoverImage : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn('group block outline-offset-4', className)}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-sunken">
        {image ? (
          <CatalogImage
            src={image.url}
            alt={image.alt}
            sizes={sizes}
            priority={priority}
            width={image.width}
            height={image.height}
            className={swap ? undefined : 'img-zoom'}
          />
        ) : (
          <ImagePlaceholder label="AUREN" />
        )}
        {image && swap ? (
          // Decorative: the first image already names the product.
          <CatalogImage src={swap.url} alt="" sizes={sizes} className="img-swap" />
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {product.categoryName ? (
          <p className="type-eyebrow text-fg-muted">{product.categoryName}</p>
        ) : null}
        <h3 className="type-body font-medium text-fg">{product.title}</h3>
        <Price
          price={deserialize(product.price)}
          compareAt={product.compareAt ? deserialize(product.compareAt) : null}
          size="sm"
        />
      </div>
    </Link>
  );
}

/** Matches a card's final size, so the grid does not shift when products arrive. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-4/5 animate-skeleton bg-skeleton" />
      <div className="mt-4 flex flex-col gap-2">
        <div className="h-3 w-16 animate-skeleton bg-skeleton" />
        <div className="h-5 w-3/4 animate-skeleton bg-skeleton" />
        <div className="h-4 w-20 animate-skeleton bg-skeleton" />
      </div>
    </div>
  );
}
