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
 * Writes the development catalog (one warehouse, categories, products, variants and images; stock
 * arrives later through the seeded purchase orders) in a single transaction. Does nothing when products exist.
 */
export async function seedCatalog(db: PrismaClient): Promise<CatalogSeedResult> {
  if ((await db.product.count()) > 0) {
    return { skipped: true, categories: 0, products: 0, variants: 0, media: 0 };
  }
  const rows = buildCatalogSeed(newId);
  await db.$transaction(
    async (tx) => {
      // The migration already created the default warehouse; give it its real name.
      const address = { line1: 'Tejgaon Industrial Area', city: 'Dhaka', country: 'BD' };
      const existing = await tx.location.findFirst({ where: { isDefault: true } });
      if (existing) {
        await tx.location.update({
          where: { id: existing.id },
          data: { name: rows.location.name, address },
        });
      } else {
        await tx.location.create({
          data: {
            id: rows.location.id,
            name: rows.location.name,
            type: 'warehouse',
            isDefault: true,
            address,
          },
        });
      }
      await tx.category.createMany({ data: rows.categories });
      await tx.product.createMany({ data: rows.products });
      await tx.productOption.createMany({ data: rows.options });
      await tx.productOptionValue.createMany({ data: rows.optionValues });
      await tx.productVariant.createMany({ data: rows.variants });
      await tx.variantOptionValue.createMany({ data: rows.variantOptionValues });
      await tx.productMedia.createMany({ data: rows.media });
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

export interface CatalogExtrasResult {
  sizeCharts: number;
  collections: number;
}

const SIZE_CHARTS = [
  {
    name: 'Shirts and polos',
    categories: ['shirts', 'polos'],
    columns: ['Chest', 'Waist', 'Shoulder', 'Sleeve'],
    rows: [
      ['S', '96', '84', '44', '63'],
      ['M', '102', '90', '46', '64'],
      ['L', '108', '96', '48', '65'],
      ['XL', '114', '102', '50', '66'],
      ['XXL', '120', '108', '52', '67'],
    ],
    howToMeasure:
      'Chest: measure around the fullest part, keeping the tape level under your arms.\n\nWaist: measure around your natural waistline, above the hips.',
    modelInfo: 'Model is 185 cm tall and wears size M.',
  },
  {
    name: 'Trousers',
    categories: ['trousers'],
    columns: ['Waist', 'Hip', 'Inseam', 'Leg opening'],
    rows: [
      ['30', '78', '98', '81', '17'],
      ['32', '82', '102', '82', '18'],
      ['34', '86', '106', '82', '18'],
      ['36', '90', '110', '83', '19'],
      ['38', '94', '114', '83', '19'],
    ],
    howToMeasure:
      'Waist: measure where you wear your trousers.\n\nInseam: from the crotch to the hem.',
    modelInfo: 'Model is 185 cm tall and wears size 32.',
  },
  {
    name: 'Tailoring and knitwear',
    categories: ['tailoring', 'knitwear'],
    columns: ['Chest', 'Shoulder', 'Length', 'Sleeve'],
    rows: [
      ['S', '98', '45', '70', '62'],
      ['M', '104', '47', '72', '63'],
      ['L', '110', '49', '74', '64'],
      ['XL', '116', '51', '76', '65'],
      ['XXL', '122', '53', '78', '66'],
    ],
    howToMeasure:
      'Measure a jacket or jumper that fits you well, laid flat, and compare the numbers.',
    modelInfo: 'Model is 185 cm tall and wears size M.',
  },
] as const;

const COLLECTIONS = [
  {
    slug: 'the-summer-edit',
    title: 'The summer edit',
    description:
      'Breathable cotton and linen for the heat, cut to stay sharp from morning to night.',
    type: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'tag', operator: 'equals', value: 'summer' }] },
    sortOrder: 'newest',
    isFeatured: true,
  },
  {
    slug: 'tailoring-for-occasions',
    title: 'Dressed for the occasion',
    description: 'Hand-picked formal pieces for weddings, meetings and long evenings.',
    type: 'manual',
    rules: {},
    sortOrder: 'manual',
    isFeatured: true,
    pickTag: 'formal',
  },
  {
    slug: 'winter-layers',
    title: 'Winter layers',
    description: 'Knits, jackets and warm tailoring for the short cold season.',
    type: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'tag', operator: 'equals', value: 'winter' }] },
    sortOrder: 'newest',
    isFeatured: false,
  },
] as const;

/**
 * Size charts (assigned to products by category) and a few collections. Each piece is skipped when
 * it already exists, so running the seed again changes nothing.
 */
export async function seedCatalogExtras(
  db: PrismaClient,
  rebuildAutomaticCollections: (tx: PrismaClient) => Promise<unknown>,
): Promise<CatalogExtrasResult> {
  let sizeCharts = 0;
  for (const def of SIZE_CHARTS) {
    if (await db.sizeChart.findFirst({ where: { name: def.name } })) continue;
    const chart = await db.sizeChart.create({
      data: {
        name: def.name,
        unit: 'cm',
        table: {
          columns: [...def.columns],
          rows: def.rows.map(([size, ...values]) => ({ size, values })),
        },
        howToMeasure: def.howToMeasure,
        modelInfo: def.modelInfo,
      },
    });
    await db.product.updateMany({
      where: { sizeChartId: null, category: { slug: { in: [...def.categories] } } },
      data: { sizeChartId: chart.id },
    });
    sizeCharts += 1;
  }

  let collections = 0;
  const published = new Date(Date.now() - 24 * 3_600_000);
  for (const def of COLLECTIONS) {
    if (await db.collection.findUnique({ where: { slug: def.slug } })) continue;
    const collection = await db.collection.create({
      data: {
        slug: def.slug,
        title: def.title,
        description: def.description,
        type: def.type,
        rules: def.rules,
        sortOrder: def.sortOrder,
        isFeatured: def.isFeatured,
        publishedAt: published,
        seoTitle: `${def.title} | AUREN`,
        seoDescription: def.description,
      },
    });
    if ('pickTag' in def) {
      const picks = await db.product.findMany({
        where: { status: 'active', tags: { has: def.pickTag } },
        orderBy: [{ featuredRank: 'asc' }, { title: 'asc' }],
        select: { id: true },
        take: 8,
      });
      await db.collectionProduct.createMany({
        data: picks.map((p, position) => ({
          collectionId: collection.id,
          productId: p.id,
          position,
        })),
      });
    }
    collections += 1;
  }
  if (collections > 0) await rebuildAutomaticCollections(db);
  return { sizeCharts, collections };
}
