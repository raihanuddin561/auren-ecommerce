import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

export const searchCardInclude = {
  category: { select: { name: true } },
  variants: {
    where: { status: 'active' as const },
    select: {
      id: true,
      priceMinor: true,
      compareAtMinor: true,
      currency: true,
      optionValues: {
        select: {
          optionValue: {
            select: {
              id: true,
              label: true,
              value: true,
              swatchHex: true,
              position: true,
              option: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { priceMinor: 'asc' as const },
  },
  media: {
    select: {
      url: true,
      alt: true,
      width: true,
      height: true,
      optionValueId: true,
      dominantColor: true,
      blurData: true,
    },
    orderBy: { position: 'asc' as const },
    take: 24,
  },
} satisfies Prisma.ProductInclude;

export type SearchProductRow = Prisma.ProductGetPayload<{ include: typeof searchCardInclude }>;

const publishedWhere = (now: Date): Prisma.ProductWhereInput => ({
  status: 'active',
  deletedAt: null,
  publishedAt: { lte: now },
});

export async function searchPublishedProducts(
  tx: Tx,
  query: string,
  now: Date,
  options: { take?: number; skip?: number } = {},
): Promise<{ items: SearchProductRow[]; total: number }> {
  const take = options.take ?? 24;
  const skip = options.skip ?? 0;
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);

  if (words.length === 0) {
    return { items: [], total: 0 };
  }

  const baseWhere = publishedWhere(now);

  // Require every word to match across product fields
  const andFilter: Prisma.ProductWhereInput[] = words.map((word) => ({
    OR: [
      { title: { contains: word, mode: 'insensitive' } },
      { subtitle: { contains: word, mode: 'insensitive' } },
      { description: { contains: word, mode: 'insensitive' } },
      { material: { contains: word, mode: 'insensitive' } },
      { productType: { contains: word, mode: 'insensitive' } },
      { tags: { has: word.toLowerCase() } },
      { category: { name: { contains: word, mode: 'insensitive' } } },
      { variants: { some: { sku: { contains: word, mode: 'insensitive' }, status: 'active' } } },
    ],
  }));

  const where: Prisma.ProductWhereInput = {
    ...baseWhere,
    AND: andFilter,
  };

  const [total, items] = await Promise.all([
    tx.product.count({ where }),
    tx.product.findMany({
      where,
      include: searchCardInclude,
      orderBy: [{ featuredRank: 'desc' }, { publishedAt: 'desc' }],
      take,
      skip,
    }),
  ]);

  return { items, total };
}

export async function searchMatchingCategories(tx: Tx, query: string, limit = 4) {
  const clean = query.trim();
  if (!clean) return [];

  return tx.category.findMany({
    where: {
      isActive: true,
      name: { contains: clean, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      path: true,
      slug: true,
    },
    take: limit,
  });
}

export async function listCuratedFallbackProducts(
  tx: Tx,
  now: Date,
  limit = 4,
): Promise<SearchProductRow[]> {
  return tx.product.findMany({
    where: publishedWhere(now),
    include: searchCardInclude,
    orderBy: [{ featuredRank: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });
}
