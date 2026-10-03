import Link from 'next/link';
import { CatalogImage, ImagePlaceholder } from './catalog-image';

export interface CategoryTileView {
  id: string;
  name: string;
  path: string;
  image: string | null;
  imageAlt: string | null;
}

const TILE_SIZES = '(min-width: 1280px) 24vw, (min-width: 768px) 32vw, 46vw';

/**
 * Tall 4:5 tiles, one per top-level category. The name sits under the image rather than on it, so
 * contrast never depends on the photograph. Without an image the tile is a calm typographic one.
 */
export function CategoryTiles({ categories }: { categories: CategoryTileView[] }) {
  return (
    <ul
      aria-label="Categories"
      className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4"
    >
      {categories.map((category) => (
        <li key={category.id}>
          <Link href={`/shop/${category.path}`} className="group block outline-offset-4">
            <div className="relative aspect-4/5 overflow-hidden bg-sunken">
              {category.image ? (
                <CatalogImage
                  src={category.image}
                  alt={category.imageAlt ?? ''}
                  sizes={TILE_SIZES}
                  className="img-zoom"
                />
              ) : (
                <ImagePlaceholder label={category.name} className="border border-line" />
              )}
            </div>
            <p className="mt-4 type-h3 text-fg underline decoration-transparent decoration-1 underline-offset-4 transition-auren-fast group-hover:decoration-gold">
              {category.name}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CategoryTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true">
          <div className="aspect-4/5 animate-skeleton bg-skeleton" />
          <div className="mt-4 h-6 w-1/2 animate-skeleton bg-skeleton" />
        </div>
      ))}
    </div>
  );
}
