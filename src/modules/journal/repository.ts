import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type {
  ArticleListItem,
  ArticleDetailItem,
  ArticleFilterParams,
  CreateArticleInput,
  UpdateArticleInput,
  ArticleProductSummary,
  RssFeedItem,
} from './types';

function mapArticleProduct(product: {
  id: string;
  title: string;
  slug: string;
  material: string | null;
  variants: Array<{ priceMinor: bigint; compareAtMinor: bigint | null }>;
  media: Array<{ url: string; alt: string }>;
}): ArticleProductSummary {
  const primaryVariant = product.variants[0];
  const primaryMedia = product.media[0];

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    priceMinor: primaryVariant?.priceMinor ?? null,
    compareAtMinor: primaryVariant?.compareAtMinor ?? null,
    primaryImage: primaryMedia?.url ?? null,
    material: product.material,
  };
}

export async function listArticles(
  filter?: ArticleFilterParams,
): Promise<{ items: ArticleListItem[]; totalCount: number }> {
  const where: Prisma.ArticleWhereInput = {};

  if (filter?.status && filter.status !== 'all') {
    where.status = filter.status;
  }

  if (filter?.category && filter.category !== 'all') {
    where.category = { equals: filter.category, mode: 'insensitive' };
  }

  if (filter?.tag) {
    where.tags = { has: filter.tag };
  }

  if (filter?.search) {
    const s = filter.search.trim();
    where.OR = [
      { title: { contains: s, mode: 'insensitive' } },
      { excerpt: { contains: s, mode: 'insensitive' } },
      { authorName: { contains: s, mode: 'insensitive' } },
    ];
  }

  const page = filter?.page ?? 1;
  const pageSize = filter?.pageSize ?? 12;
  const skip = (page - 1) * pageSize;

  const [rows, totalCount] = await Promise.all([
    db.article.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { products: true },
        },
      },
    }),
    db.article.count({ where }),
  ]);

  const items: ArticleListItem[] = rows.map((art) => ({
    id: art.id,
    title: art.title,
    slug: art.slug,
    excerpt: art.excerpt,
    heroImage: art.heroImage,
    heroImageAlt: art.heroImageAlt,
    category: art.category,
    tags: art.tags,
    authorName: art.authorName,
    status: art.status,
    readTimeMinutes: art.readTimeMinutes,
    publishedAt: art.publishedAt,
    createdAt: art.createdAt,
    updatedAt: art.updatedAt,
    featuredProductCount: art._count.products,
  }));

  return { items, totalCount };
}

export async function getArticleBySlug(
  slug: string,
  onlyPublished = true,
): Promise<ArticleDetailItem | null> {
  const where: Prisma.ArticleWhereInput = { slug };
  if (onlyPublished) {
    where.status = 'published';
  }

  const art = await db.article.findFirst({
    where,
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              material: true,
              variants: {
                where: { status: 'active' },
                orderBy: { priceMinor: 'asc' },
                take: 1,
                select: { priceMinor: true, compareAtMinor: true },
              },
              media: {
                orderBy: { position: 'asc' },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      },
    },
  });

  if (!art) return null;

  return {
    id: art.id,
    title: art.title,
    slug: art.slug,
    excerpt: art.excerpt,
    content: art.content,
    heroImage: art.heroImage,
    heroImageAlt: art.heroImageAlt,
    category: art.category,
    tags: art.tags,
    authorName: art.authorName,
    status: art.status,
    readTimeMinutes: art.readTimeMinutes,
    seoTitle: art.seoTitle,
    seoDescription: art.seoDescription,
    publishedAt: art.publishedAt,
    createdAt: art.createdAt,
    updatedAt: art.updatedAt,
    featuredProducts: art.products.map((p) => mapArticleProduct(p.product)),
  };
}

export async function getArticleById(id: string): Promise<ArticleDetailItem | null> {
  const art = await db.article.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              material: true,
              variants: {
                where: { status: 'active' },
                orderBy: { priceMinor: 'asc' },
                take: 1,
                select: { priceMinor: true, compareAtMinor: true },
              },
              media: {
                orderBy: { position: 'asc' },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      },
    },
  });

  if (!art) return null;

  return {
    id: art.id,
    title: art.title,
    slug: art.slug,
    excerpt: art.excerpt,
    content: art.content,
    heroImage: art.heroImage,
    heroImageAlt: art.heroImageAlt,
    category: art.category,
    tags: art.tags,
    authorName: art.authorName,
    status: art.status,
    readTimeMinutes: art.readTimeMinutes,
    seoTitle: art.seoTitle,
    seoDescription: art.seoDescription,
    publishedAt: art.publishedAt,
    createdAt: art.createdAt,
    updatedAt: art.updatedAt,
    featuredProducts: art.products.map((p) => mapArticleProduct(p.product)),
  };
}

export async function createArticle(
  data: CreateArticleInput,
): Promise<{ id: string; slug: string }> {
  const publishedAt = data.status === 'published' ? new Date() : null;

  return db.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        heroImage: data.heroImage,
        heroImageAlt: data.heroImageAlt,
        category: data.category ?? 'Editorial',
        tags: data.tags ?? [],
        authorName: data.authorName ?? 'Auren Atelier',
        status: data.status ?? 'draft',
        readTimeMinutes: data.readTimeMinutes ?? 3,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        publishedAt,
      },
      select: { id: true, slug: true },
    });

    if (data.featuredProductIds && data.featuredProductIds.length > 0) {
      await tx.articleProduct.createMany({
        data: data.featuredProductIds.map((productId, index) => ({
          articleId: created.id,
          productId,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });
}

export async function updateArticle(id: string, data: Partial<UpdateArticleInput>) {
  return db.$transaction(async (tx) => {
    const updateData: Prisma.ArticleUpdateInput = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.heroImage !== undefined ? { heroImage: data.heroImage } : {}),
      ...(data.heroImageAlt !== undefined ? { heroImageAlt: data.heroImageAlt } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.authorName !== undefined ? { authorName: data.authorName } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.readTimeMinutes !== undefined ? { readTimeMinutes: data.readTimeMinutes } : {}),
      ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription } : {}),
    };

    if (data.status === 'published') {
      updateData.publishedAt = new Date();
    } else if (data.status === 'draft') {
      updateData.publishedAt = null;
    }

    const updated = await tx.article.update({
      where: { id },
      data: updateData,
    });

    if (data.featuredProductIds !== undefined) {
      await tx.articleProduct.deleteMany({ where: { articleId: id } });
      if (data.featuredProductIds.length > 0) {
        await tx.articleProduct.createMany({
          data: data.featuredProductIds.map((productId, index) => ({
            articleId: id,
            productId,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });
}

export async function deleteArticle(id: string) {
  return db.article.delete({ where: { id } });
}

export async function getPublishedArticlesForRss(limit = 30): Promise<RssFeedItem[]> {
  const rows = await db.article.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      authorName: true,
      category: true,
    },
  });

  return rows.map((r) => ({
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt ?? new Date(),
    authorName: r.authorName,
    category: r.category,
  }));
}

export async function getDistinctCategoriesAndTags(): Promise<{
  categories: string[];
  tags: string[];
}> {
  const articles = await db.article.findMany({
    where: { status: 'published' },
    select: { category: true, tags: true },
  });

  const categories = Array.from(new Set(articles.map((a) => a.category))).filter(Boolean);
  const tags = Array.from(new Set(articles.flatMap((a) => a.tags))).filter(Boolean);

  return { categories, tags };
}
