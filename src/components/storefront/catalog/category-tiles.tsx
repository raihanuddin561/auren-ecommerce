import Link from 'next/link';
import { CatalogImage } from './catalog-image';

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
      className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4"
    >
      {categories.map((category) => (
        <li key={category.id}>
          <Link href={`/shop/${category.path}`} className="group block outline-offset-4">
            <div className="group/tile hover:shadow-lg relative aspect-4/5 overflow-hidden rounded-xs border border-line/60 bg-raised/40 transition-all duration-500 hover:border-gold/70">
              {category.image ? (
                <CatalogImage
                  src={category.image}
                  alt={category.imageAlt ?? ''}
                  sizes={TILE_SIZES}
                  className="size-full object-cover transition-transform duration-700 ease-auren group-hover/tile:scale-105"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center bg-gradient-to-b from-raised/80 via-sunken to-ink/60 p-6 text-center">
                  <span className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
                    Auren Atelier
                  </span>
                  <span className="mt-2.5 type-h3 font-display text-fg">{category.name}</span>
                  <span className="mt-4 rounded-xs border border-line/80 px-2.5 py-1 type-caption font-medium tracking-wider text-fg-muted uppercase transition-colors group-hover/tile:border-gold/60 group-hover/tile:text-gold">
                    View Collection
                  </span>
                </div>
              )}
              {/* Soft bottom scrim for contrast */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-page/80 to-transparent opacity-0 transition-opacity duration-300 group-hover/tile:opacity-100" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="type-h3 text-fg transition-colors duration-200 group-hover:text-gold">
                {category.name}
              </p>
              <span className="flex -translate-x-1.5 items-center gap-1 type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                Explore <span>&rarr;</span>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CategoryTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true">
          <div className="aspect-4/5 animate-skeleton rounded-xs bg-skeleton" />
          <div className="mt-3 h-5 w-1/2 animate-skeleton bg-skeleton" />
        </div>
      ))}
    </div>
  );
}
