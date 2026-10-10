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

const CATEGORY_EDITORIAL_IMAGES: Record<string, string> = {
  shirts: '/editorial/category-shirts.jpg',
  shirting: '/editorial/category-shirts.jpg',
  tailoring: '/editorial/category-tailoring.jpg',
  suits: '/editorial/category-tailoring.jpg',
  panjabi: '/editorial/category-panjabi.jpg',
  panjabis: '/editorial/category-panjabi.jpg',
  trousers: '/editorial/craftsmanship.jpg',
  knitwear: '/editorial/lookbook.jpg',
  polos: '/editorial/lookbook.jpg',
  accessories: '/editorial/atelier.jpg',
};

function getCategoryFallbackImage(path: string, name: string): string | null {
  const normalizedPath = path.toLowerCase();
  const normalizedName = name.toLowerCase();

  for (const [key, image] of Object.entries(CATEGORY_EDITORIAL_IMAGES)) {
    if (normalizedPath.includes(key) || normalizedName.includes(key)) {
      return image;
    }
  }
  return null;
}

/**
 * Tall 4:5 tiles, one per top-level category.
 * Features high-fashion editorial imagery with smooth zoom, gold hover hairline,
 * and elegant typographic exploration cues.
 */
export function CategoryTiles({ categories }: { categories: CategoryTileView[] }) {
  return (
    <ul
      aria-label="Categories"
      className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4"
    >
      {categories.map((category) => {
        const displayImage =
          category.image || getCategoryFallbackImage(category.path, category.name);
        const displayAlt =
          category.imageAlt || `${category.name} tailoring and menswear collection`;

        return (
          <li key={category.id}>
            <Link href={`/shop/${category.path}`} className="group block outline-offset-4">
              <div className="group/tile hover:shadow-soft relative aspect-4/5 overflow-hidden rounded-xs border border-line/60 bg-raised/40 transition-all duration-500 hover:border-gold">
                {displayImage ? (
                  <CatalogImage
                    src={displayImage}
                    alt={displayAlt}
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
                {/* Soft bottom scrim for high-contrast typography and subtle depth */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent opacity-60 transition-opacity duration-300 group-hover/tile:opacity-80" />

                {/* Subtle corner gold accent on hover */}
                <div className="pointer-events-none absolute top-3 right-3 rounded-xs border border-gold/40 bg-page/80 px-2 py-0.5 type-caption font-mono text-gold opacity-0 backdrop-blur-xs transition-opacity duration-300 group-hover/tile:opacity-100">
                  Capsule
                </div>
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
        );
      })}
    </ul>
  );
}

/** Matches the grid of tall tiles, so nothing shifts when data arrives. */
export function CategoryTilesSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 xl:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-4/5 animate-skeleton rounded-xs bg-skeleton" />
          <div className="mt-3 h-5 w-24 animate-skeleton rounded-xs bg-skeleton" />
        </div>
      ))}
    </div>
  );
}
