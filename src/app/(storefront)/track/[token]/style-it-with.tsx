import { unstable_rethrow } from 'next/navigation';
import { ProductGrid } from '@/components/storefront/catalog/product-grid';
import { getNewArrivals } from '@/modules/catalog/queries';
import { logger } from '@/lib/logger';

/** An editorial rail at the end of the order page. It must never stop the order from showing. */
export async function StyleItWith() {
  let cards: Awaited<ReturnType<typeof getNewArrivals>> = [];
  try {
    cards = (await getNewArrivals(4)).slice(0, 4);
  } catch (error) {
    unstable_rethrow(error);
    logger.warn({ err: error }, 'order page rail unavailable');
  }
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="style-it-with">
      <p className="type-eyebrow text-accent-text">The edit</p>
      <h2 id="style-it-with" className="mt-2 mb-8 type-h2 text-fg">
        Style it with
      </h2>
      <ProductGrid products={cards} label="New arrivals" />
    </section>
  );
}
