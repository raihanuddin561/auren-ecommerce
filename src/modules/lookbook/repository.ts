import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type {
  LookbookListItem,
  LookbookDetailItem,
  LookbookFilterParams,
  CreateLookbookInput,
  UpdateLookbookInput,
  CreateSlideInput,
  UpdateSlideInput,
  CreateHotspotInput,
  UpdateHotspotInput,
  ProductSummaryForHotspot,
} from './types';

function mapHotspotProduct(product: {
  id: string;
  title: string;
  slug: string;
  material: string | null;
  variants: Array<{ priceMinor: bigint; compareAtMinor: bigint | null }>;
  media: Array<{ url: string; alt: string }>;
}): ProductSummaryForHotspot {
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

export async function listLookbooks(filter?: LookbookFilterParams): Promise<LookbookListItem[]> {
  const where: Prisma.LookbookWhereInput = {};

  if (filter?.status && filter.status !== 'all') {
    where.status = filter.status;
  }

  if (filter?.season) {
    where.season = { contains: filter.season, mode: 'insensitive' };
  }

  if (filter?.search) {
    const s = filter.search.trim();
    where.OR = [
      { title: { contains: s, mode: 'insensitive' } },
      { season: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
    ];
  }

  const rows = await db.lookbook.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      slides: {
        include: {
          hotspots: {
            select: { id: true },
          },
        },
      },
    },
  });

  return rows.map((lb) => ({
    id: lb.id,
    title: lb.title,
    slug: lb.slug,
    season: lb.season,
    description: lb.description,
    heroImage: lb.heroImage,
    heroImageAlt: lb.heroImageAlt,
    status: lb.status,
    sortOrder: lb.sortOrder,
    publishedAt: lb.publishedAt,
    slideCount: lb.slides.length,
    hotspotCount: lb.slides.reduce((acc, s) => acc + s.hotspots.length, 0),
    createdAt: lb.createdAt,
    updatedAt: lb.updatedAt,
  }));
}

export async function getLookbookBySlug(
  slug: string,
  onlyPublished = true,
): Promise<LookbookDetailItem | null> {
  const where: Prisma.LookbookWhereInput = { slug };
  if (onlyPublished) {
    where.status = 'published';
  }

  const lb = await db.lookbook.findFirst({
    where,
    include: {
      slides: {
        orderBy: { sortOrder: 'asc' },
        include: {
          hotspots: {
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
      },
    },
  });

  if (!lb) return null;

  return {
    id: lb.id,
    title: lb.title,
    slug: lb.slug,
    season: lb.season,
    description: lb.description,
    heroImage: lb.heroImage,
    heroImageAlt: lb.heroImageAlt,
    status: lb.status,
    sortOrder: lb.sortOrder,
    publishedAt: lb.publishedAt,
    createdAt: lb.createdAt,
    updatedAt: lb.updatedAt,
    slides: lb.slides.map((s) => ({
      id: s.id,
      lookbookId: s.lookbookId,
      imageUrl: s.imageUrl,
      imageAlt: s.imageAlt,
      title: s.title,
      caption: s.caption,
      sortOrder: s.sortOrder,
      hotspots: s.hotspots.map((h) => ({
        id: h.id,
        slideId: h.slideId,
        productId: h.productId,
        x: h.x,
        y: h.y,
        label: h.label,
        product: mapHotspotProduct(h.product),
      })),
    })),
  };
}

export async function getLookbookById(id: string): Promise<LookbookDetailItem | null> {
  const lb = await db.lookbook.findUnique({
    where: { id },
    include: {
      slides: {
        orderBy: { sortOrder: 'asc' },
        include: {
          hotspots: {
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
      },
    },
  });

  if (!lb) return null;

  return {
    id: lb.id,
    title: lb.title,
    slug: lb.slug,
    season: lb.season,
    description: lb.description,
    heroImage: lb.heroImage,
    heroImageAlt: lb.heroImageAlt,
    status: lb.status,
    sortOrder: lb.sortOrder,
    publishedAt: lb.publishedAt,
    createdAt: lb.createdAt,
    updatedAt: lb.updatedAt,
    slides: lb.slides.map((s) => ({
      id: s.id,
      lookbookId: s.lookbookId,
      imageUrl: s.imageUrl,
      imageAlt: s.imageAlt,
      title: s.title,
      caption: s.caption,
      sortOrder: s.sortOrder,
      hotspots: s.hotspots.map((h) => ({
        id: h.id,
        slideId: h.slideId,
        productId: h.productId,
        x: h.x,
        y: h.y,
        label: h.label,
        product: mapHotspotProduct(h.product),
      })),
    })),
  };
}

export async function createLookbook(
  data: CreateLookbookInput,
): Promise<{ id: string; slug: string }> {
  const publishedAt = data.status === 'published' ? new Date() : null;
  const row = await db.lookbook.create({
    data: {
      title: data.title,
      slug: data.slug,
      season: data.season,
      description: data.description,
      heroImage: data.heroImage,
      heroImageAlt: data.heroImageAlt,
      status: data.status ?? 'draft',
      sortOrder: data.sortOrder ?? 0,
      publishedAt,
    },
    select: { id: true, slug: true },
  });
  return row;
}

export async function updateLookbook(id: string, data: Partial<UpdateLookbookInput>) {
  const updateData: Prisma.LookbookUpdateInput = {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.slug !== undefined ? { slug: data.slug } : {}),
    ...(data.season !== undefined ? { season: data.season } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.heroImage !== undefined ? { heroImage: data.heroImage } : {}),
    ...(data.heroImageAlt !== undefined ? { heroImageAlt: data.heroImageAlt } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
  };

  if (data.status === 'published') {
    updateData.publishedAt = new Date();
  } else if (data.status === 'draft') {
    updateData.publishedAt = null;
  }

  return db.lookbook.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteLookbook(id: string) {
  return db.lookbook.delete({
    where: { id },
  });
}

export async function createSlide(data: CreateSlideInput) {
  return db.lookbookSlide.create({
    data: {
      lookbookId: data.lookbookId,
      imageUrl: data.imageUrl,
      imageAlt: data.imageAlt,
      title: data.title,
      caption: data.caption,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateSlide(id: string, data: Partial<UpdateSlideInput>) {
  return db.lookbookSlide.update({
    where: { id },
    data: {
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.imageAlt !== undefined ? { imageAlt: data.imageAlt } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.caption !== undefined ? { caption: data.caption } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
}

export async function deleteSlide(id: string) {
  return db.lookbookSlide.delete({
    where: { id },
  });
}

export async function reorderSlides(lookbookId: string, slideIds: string[]) {
  return db.$transaction(
    slideIds.map((slideId, index) =>
      db.lookbookSlide.update({
        where: { id: slideId, lookbookId },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function createHotspot(data: CreateHotspotInput) {
  return db.lookbookHotspot.create({
    data: {
      slideId: data.slideId,
      productId: data.productId,
      x: data.x,
      y: data.y,
      label: data.label,
    },
  });
}

export async function updateHotspot(id: string, data: Partial<UpdateHotspotInput>) {
  return db.lookbookHotspot.update({
    where: { id },
    data: {
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
      ...(data.x !== undefined ? { x: data.x } : {}),
      ...(data.y !== undefined ? { y: data.y } : {}),
      ...(data.label !== undefined ? { label: data.label } : {}),
    },
  });
}

export async function deleteHotspot(id: string) {
  return db.lookbookHotspot.delete({
    where: { id },
  });
}

export async function searchProductsForHotspots(query: string) {
  const q = query.trim();
  const where: Prisma.ProductWhereInput = {
    status: 'active',
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { material: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const products = await db.product.findMany({
    where,
    take: 20,
    orderBy: { createdAt: 'desc' },
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
  });

  return products.map(mapHotspotProduct);
}
