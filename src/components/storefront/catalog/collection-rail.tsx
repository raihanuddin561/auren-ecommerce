import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CatalogImage } from './catalog-image';
import { ProductGrid } from './product-grid';
import type { ProductCardView } from './product-card';
import { SectionHeader } from './section-header';

export interface CollectionRailView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hero: { url: string; alt: string } | null;
  products: ProductCardView[];
}

/**
 * A collection with its first products. The hero image, when there is one, sits above as a calm
 * banner; without it the header is typographic and the products carry the section.
 */
export function CollectionRail({
  collection,
  headingId,
}: {
  collection: CollectionRailView;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="py-20 md:py-32">
      <div className="container-page">
        {collection.hero ? (
          <div className="relative mb-10 aspect-4/3 overflow-hidden bg-sunken md:mb-14 md:aspect-21/9">
            <CatalogImage
              src={collection.hero.url}
              alt={collection.hero.alt}
              sizes="(min-width: 1440px) 1360px, 100vw"
            />
          </div>
        ) : null}
        <SectionHeader
          id={headingId}
          eyebrow="Collection"
          title={collection.title}
          description={collection.description}
          action={
            <Button asChild variant="link">
              <Link href={`/collections/${collection.slug}`}>
                View the collection
                <span className="sr-only">: {collection.title}</span>
              </Link>
            </Button>
          }
        />
        <ProductGrid products={collection.products} label={`${collection.title} products`} />
      </div>
    </section>
  );
}
