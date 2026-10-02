import type { PrismaClient } from '../src/generated/prisma/client';
import { newId } from '../src/lib/ids';
import { buildCatalogSeed } from './seed-data';

export interface CatalogSeedResult {
  skipped: boolean;
  categories: number;
  products: number;
  variants: number;
  media: number;
}

/**
 * Writes the development catalog (one warehouse, categories, products, variants, images, opening
 * stock and the matching stock ledger) in a single transaction. Does nothing when products exist.
 */
export async function seedCatalog(db: PrismaClient): Promise<CatalogSeedResult> {
  if ((await db.product.count()) > 0) {
    return { skipped: true, categories: 0, products: 0, variants: 0, media: 0 };
  }
  const rows = buildCatalogSeed(newId);
  await db.$transaction(
    async (tx) => {
      await tx.location.create({
        data: {
          id: rows.location.id,
          name: rows.location.name,
          type: 'warehouse',
          isDefault: true,
          address: { line1: 'Tejgaon Industrial Area', city: 'Dhaka', country: 'BD' },
        },
      });
      await tx.category.createMany({ data: rows.categories });
      await tx.product.createMany({ data: rows.products });
      await tx.productOption.createMany({ data: rows.options });
      await tx.productOptionValue.createMany({ data: rows.optionValues });
      await tx.productVariant.createMany({ data: rows.variants });
      await tx.variantOptionValue.createMany({ data: rows.variantOptionValues });
      await tx.productMedia.createMany({ data: rows.media });
      await tx.inventoryLevel.createMany({ data: rows.inventory });
      await tx.stockMovement.createMany({ data: rows.movements });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return {
    skipped: false,
    categories: rows.categories.length,
    products: rows.products.length,
    variants: rows.variants.length,
    media: rows.media.length,
  };
}
