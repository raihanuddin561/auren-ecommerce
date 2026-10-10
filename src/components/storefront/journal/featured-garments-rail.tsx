import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';
import type { ArticleProductSummary } from '@/modules/journal/types';

interface FeaturedGarmentsRailProps {
  products: ArticleProductSummary[];
}

export function FeaturedGarmentsRail({ products }: FeaturedGarmentsRailProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="border-t border-line bg-raised/30 py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
            Atelier Capsule
          </span>
          <h2 className="type-title-md mt-2 font-serif text-fg">Pieces Featured in this Story</h2>
          <p className="mt-2 type-caption text-fg-muted">
            Crafted from the noble fibers and tailoring standards discussed above.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className="group hover:shadow-xs flex flex-col rounded-xs border border-line bg-page p-3 transition-all duration-300 hover:border-accent-text/40"
            >
              <div className="relative aspect-4/5 w-full overflow-hidden rounded-xs bg-raised">
                {p.primaryImage ? (
                  <Image
                    src={p.primaryImage}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-fg-muted">
                    <ShoppingBag size={24} />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-1 flex-col">
                <h3 className="line-clamp-1 type-body-sm font-medium text-fg group-hover:text-accent-text">
                  {p.title}
                </h3>
                {p.material && (
                  <p className="line-clamp-1 type-caption text-fg-muted">{p.material}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  {p.priceMinor !== null && (
                    <span className="type-body-sm font-mono font-medium text-fg">
                      {formatPriceText(money(p.priceMinor, 'BDT'))}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 type-caption font-mono text-accent-text">
                    <span>View Piece</span>
                    <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
