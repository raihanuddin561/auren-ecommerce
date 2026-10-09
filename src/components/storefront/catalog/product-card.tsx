import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { cardBadges, type ProductCardData } from '@/modules/catalog/card';
import { ImagePlaceholder, safeColor } from './catalog-image';
import { CardImages, CardState, ColorSwatches, QuickAdd } from './product-card-client';
import { WishlistButton } from './wishlist-button';

/**
 * What a card needs. Matches the catalogue's card data, which is serialisable across the server
 * boundary; everything beyond the basics is optional so a plain card (no colours, no stock) works.
 */
export type ProductCardView = Pick<
  ProductCardData,
  'id' | 'slug' | 'title' | 'categoryName' | 'price' | 'compareAt' | 'image' | 'hoverImage'
> &
  Partial<Pick<ProductCardData, 'colors' | 'sizes' | 'variants' | 'isNew' | 'limited' | 'stock'>>;

interface ProductCardProps {
  product: ProductCardView;
  /** Responsive sizes hint for the image. */
  sizes?: string;
  /** Set for the first row above the fold only. */
  priority?: boolean;
  className?: string;
}

export const CARD_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw';

const BADGE_TONE = {
  'sold-out': 'ink',
  'low-stock': 'warning',
  limited: 'oxblood',
  sale: 'oxblood',
  new: 'gold',
} as const;

/**
 * A product in a grid: 4:5 picture, second picture on hover and keyboard focus (pointer devices),
 * colour swatches that switch the picture, badges, a quick-add size row on desktop hover or focus,
 * a wishlist heart, then category, name and price.
 *
 * The whole card is one link without nesting: the link is the product name, stretched over the card
 * with a pseudo-element, and the swatches, quick-add and heart are siblings positioned above it.
 */
export function ProductCard({
  product,
  sizes = CARD_SIZES,
  priority = false,
  className,
}: ProductCardProps) {
  const { image, hoverImage } = product;
  const badges = cardBadges(product);
  const background = safeColor(image?.dominantColor);

  return (
    <article className={cn('group relative', className)} data-stock={product.stock ?? undefined}>
      <CardState
        colors={product.colors ?? []}
        variants={product.variants ?? []}
        sizes={product.sizes ?? []}
      >
        <div
          className="relative aspect-4/5 overflow-hidden bg-sunken"
          style={background ? { backgroundColor: background } : undefined}
        >
          {image ? (
            <CardImages
              image={image}
              hoverImage={hoverImage}
              title={product.title}
              sizes={sizes}
              priority={priority}
            />
          ) : (
            <ImagePlaceholder label="AUREN" />
          )}
          {badges.length > 0 ? (
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
              {badges.map((badge) => (
                <Badge
                  key={badge.key}
                  tone={BADGE_TONE[badge.key]}
                  className={
                    badge.key === 'low-stock' || badge.key === 'new' ? 'bg-page/90' : undefined
                  }
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}
          <WishlistButton
            productId={product.id}
            title={product.title}
            className="absolute top-1 right-1"
          />
          <QuickAdd title={product.title} />
        </div>
        <div className="mt-4 flex flex-col gap-1">
          {product.categoryName ? (
            <p className="type-eyebrow text-fg-muted">{product.categoryName}</p>
          ) : null}
          <h3 className="type-body font-medium text-fg">
            <Link
              href={`/products/${product.slug}`}
              className="outline-none after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-gold"
            >
              {product.title}
            </Link>
          </h3>
          <Price
            price={deserialize(product.price)}
            compareAt={product.compareAt ? deserialize(product.compareAt) : null}
            size="sm"
          />
          <ColorSwatches />
        </div>
      </CardState>
    </article>
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
