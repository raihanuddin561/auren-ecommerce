import 'server-only';
import { db, type Tx } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type {
  AdminReviewFilterParams,
  AdminReviewsOverviewMetrics,
  AdminReviewsResult,
  FitFeedback,
  ProductRatingStatsData,
  ReviewFilterParams,
  ReviewItem,
  ReviewStatus,
  SubmitReviewInput,
} from './types';

function mapReviewRow(row: {
  id: string;
  productId: string;
  userId: string | null;
  orderItemId: string | null;
  authorName: string;
  authorEmail: string | null;
  rating: number;
  title: string;
  body: string;
  fitFeedback: string;
  sizePurchased: string | null;
  heightCm: number | null;
  isVerified: boolean;
  status: string;
  helpfulCount: number;
  moderationNote: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  media?: Array<{
    id: string;
    url: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }>;
  product?: {
    title: string;
    slug: string;
  } | null;
}): ReviewItem {
  return {
    id: row.id,
    productId: row.productId,
    productTitle: row.product?.title,
    productSlug: row.product?.slug,
    userId: row.userId,
    orderItemId: row.orderItemId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    rating: row.rating,
    title: row.title,
    body: row.body,
    fitFeedback: row.fitFeedback as FitFeedback,
    sizePurchased: row.sizePurchased,
    heightCm: row.heightCm,
    isVerified: row.isVerified,
    status: row.status as ReviewStatus,
    helpfulCount: row.helpfulCount,
    moderationNote: row.moderationNote,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    media: (row.media ?? []).map((m) => ({
      id: m.id,
      url: m.url,
      width: m.width,
      height: m.height,
      sortOrder: m.sortOrder,
    })),
  };
}

export async function createReview(
  input: SubmitReviewInput,
  options: {
    userId?: string | null;
    isVerified: boolean;
    orderItemId?: string | null;
    status: ReviewStatus;
  },
  client: Tx = db,
): Promise<ReviewItem> {
  const isApproved = options.status === 'approved';
  const row = await client.review.create({
    data: {
      productId: input.productId,
      userId: options.userId ?? null,
      orderItemId: options.orderItemId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail || null,
      rating: input.rating,
      title: input.title,
      body: input.body,
      fitFeedback: input.fitFeedback,
      sizePurchased: input.sizePurchased ?? null,
      heightCm: input.heightCm ?? null,
      isVerified: options.isVerified,
      status: options.status,
      publishedAt: isApproved ? new Date() : null,
      media: {
        create: (input.mediaUrls ?? []).map((url, index) => ({
          url,
          sortOrder: index,
        })),
      },
    },
    include: {
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      product: {
        select: { title: true, slug: true },
      },
    },
  });

  return mapReviewRow(row);
}

export async function getReviewById(id: string, client: Tx = db): Promise<ReviewItem | null> {
  const row = await client.review.findUnique({
    where: { id },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      product: { select: { title: true, slug: true } },
    },
  });

  if (!row) return null;
  return mapReviewRow(row);
}

export async function listApprovedReviewsByProductId(
  productId: string,
  params: ReviewFilterParams = {},
  client: Tx = db,
): Promise<{ items: ReviewItem[]; total: number }> {
  const where: Prisma.ReviewWhereInput = {
    productId,
    status: 'approved',
  };

  if (params.rating) {
    where.rating = params.rating;
  }
  if (params.fitFeedback) {
    where.fitFeedback = params.fitFeedback;
  }
  if (params.hasMedia) {
    where.media = { some: {} };
  }

  let orderBy: Prisma.ReviewOrderByWithRelationInput = { publishedAt: 'desc' };
  if (params.sort === 'rating_desc') {
    orderBy = { rating: 'desc' };
  } else if (params.sort === 'rating_asc') {
    orderBy = { rating: 'asc' };
  } else if (params.sort === 'helpful') {
    orderBy = { helpfulCount: 'desc' };
  }

  const [rows, total] = await Promise.all([
    client.review.findMany({
      where,
      orderBy,
      take: params.limit ?? 10,
      skip: params.offset ?? 0,
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    client.review.count({ where }),
  ]);

  return {
    items: rows.map(mapReviewRow),
    total,
  };
}

export async function getProductRatingStats(
  productId: string,
  client: Tx = db,
): Promise<ProductRatingStatsData> {
  const row = await client.productRatingStats.findUnique({
    where: { productId },
  });

  if (row) {
    const total = row.reviewCount;
    const trueToSize = row.fitTrueToSizeCount;
    const fitTrueToSizePercentage = total > 0 ? Math.round((trueToSize / total) * 100) : 100;

    return {
      productId: row.productId,
      averageRating: Number(row.averageRating.toFixed(1)),
      reviewCount: row.reviewCount,
      fitRunsSmallCount: row.fitRunsSmallCount,
      fitTrueToSizeCount: row.fitTrueToSizeCount,
      fitRunsLargeCount: row.fitRunsLargeCount,
      fitTrueToSizePercentage,
      oneStarCount: row.oneStarCount,
      twoStarCount: row.twoStarCount,
      threeStarCount: row.threeStarCount,
      fourStarCount: row.fourStarCount,
      fiveStarCount: row.fiveStarCount,
      ratingDistribution: {
        1: row.oneStarCount,
        2: row.twoStarCount,
        3: row.threeStarCount,
        4: row.fourStarCount,
        5: row.fiveStarCount,
      },
    };
  }

  return {
    productId,
    averageRating: 0,
    reviewCount: 0,
    fitRunsSmallCount: 0,
    fitTrueToSizeCount: 0,
    fitRunsLargeCount: 0,
    fitTrueToSizePercentage: 100,
    oneStarCount: 0,
    twoStarCount: 0,
    threeStarCount: 0,
    fourStarCount: 0,
    fiveStarCount: 0,
    ratingDistribution: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };
}

export async function recalculateProductRatingStats(
  productId: string,
  client: Tx = db,
): Promise<ProductRatingStatsData> {
  const reviews = await client.review.findMany({
    where: { productId, status: 'approved' },
    select: { rating: true, fitFeedback: true },
  });

  const total = reviews.length;
  let sum = 0;
  let small = 0;
  let trueFit = 0;
  let large = 0;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const r of reviews) {
    sum += r.rating;
    if (r.rating >= 1 && r.rating <= 5) {
      dist[r.rating as keyof typeof dist]++;
    }
    if (r.fitFeedback === 'runs_small') small++;
    else if (r.fitFeedback === 'runs_large') large++;
    else trueFit++;
  }

  const averageRating = total > 0 ? Number((sum / total).toFixed(1)) : 0;
  const fitTrueToSizePercentage = total > 0 ? Math.round((trueFit / total) * 100) : 100;

  await client.productRatingStats.upsert({
    where: { productId },
    create: {
      productId,
      averageRating,
      reviewCount: total,
      fitRunsSmallCount: small,
      fitTrueToSizeCount: trueFit,
      fitRunsLargeCount: large,
      oneStarCount: dist[1],
      twoStarCount: dist[2],
      threeStarCount: dist[3],
      fourStarCount: dist[4],
      fiveStarCount: dist[5],
      updatedAt: new Date(),
    },
    update: {
      averageRating,
      reviewCount: total,
      fitRunsSmallCount: small,
      fitTrueToSizeCount: trueFit,
      fitRunsLargeCount: large,
      oneStarCount: dist[1],
      twoStarCount: dist[2],
      threeStarCount: dist[3],
      fourStarCount: dist[4],
      fiveStarCount: dist[5],
      updatedAt: new Date(),
    },
  });

  return {
    productId,
    averageRating,
    reviewCount: total,
    fitRunsSmallCount: small,
    fitTrueToSizeCount: trueFit,
    fitRunsLargeCount: large,
    fitTrueToSizePercentage,
    oneStarCount: dist[1],
    twoStarCount: dist[2],
    threeStarCount: dist[3],
    fourStarCount: dist[4],
    fiveStarCount: dist[5],
    ratingDistribution: dist,
  };
}

export async function updateReviewStatus(
  reviewId: string,
  status: ReviewStatus,
  staffId: string,
  note?: string,
  client: Tx = db,
): Promise<ReviewItem> {
  const isApproved = status === 'approved';
  const row = await client.review.update({
    where: { id: reviewId },
    data: {
      status,
      moderatedBy: staffId,
      moderatedAt: new Date(),
      moderationNote: note ?? null,
      publishedAt: isApproved ? new Date() : null,
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      product: { select: { title: true, slug: true } },
    },
  });

  return mapReviewRow(row);
}

export async function incrementHelpfulCount(reviewId: string, client: Tx = db): Promise<number> {
  const updated = await client.review.update({
    where: { id: reviewId },
    data: {
      helpfulCount: { increment: 1 },
    },
    select: { helpfulCount: true },
  });
  return updated.helpfulCount;
}

export async function findDeliveredOrderItem(
  productId: string,
  options: { userId?: string | null; email?: string | null },
  client: Tx = db,
): Promise<{ orderItemId: string; sizePurchased: string | null } | null> {
  if (!options.userId && !options.email) return null;

  const item = await client.orderItem.findFirst({
    where: {
      productId,
      order: {
        status: 'delivered',
        OR: [
          ...(options.userId ? [{ userId: options.userId }] : []),
          ...(options.email ? [{ user: { email: options.email } }] : []),
        ],
      },
    },
    select: {
      id: true,
      optionsSnapshot: true,
    },
  });

  if (!item) return null;

  let sizePurchased: string | null = null;
  if (Array.isArray(item.optionsSnapshot)) {
    const sizeOpt = (item.optionsSnapshot as Array<{ name?: string; value?: string }>).find(
      (opt) => opt.name?.toLowerCase() === 'size',
    );
    if (sizeOpt?.value) sizePurchased = sizeOpt.value;
  }

  return {
    orderItemId: item.id,
    sizePurchased,
  };
}

export async function listReviewsForAdmin(
  params: AdminReviewFilterParams = {},
  client: Tx = db,
): Promise<AdminReviewsResult> {
  const where: Prisma.ReviewWhereInput = {};

  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }
  if (params.productId) {
    where.productId = params.productId;
  }
  if (params.rating) {
    where.rating = params.rating;
  }
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { authorName: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
      { product: { title: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    client.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        product: { select: { title: true, slug: true } },
      },
    }),
    client.review.count({ where }),
  ]);

  return {
    items: rows.map(mapReviewRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAdminOverviewMetrics(
  client: Tx = db,
): Promise<AdminReviewsOverviewMetrics> {
  const [totalCount, pendingCount, approvedCount, rejectedCount, approvedReviews, verifiedCount] =
    await Promise.all([
      client.review.count(),
      client.review.count({ where: { status: 'pending' } }),
      client.review.count({ where: { status: 'approved' } }),
      client.review.count({ where: { status: 'rejected' } }),
      client.review.findMany({
        where: { status: 'approved' },
        select: { rating: true },
      }),
      client.review.count({ where: { isVerified: true } }),
    ]);

  const avg =
    approvedReviews.length > 0
      ? Number(
          (approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length).toFixed(
            1,
          ),
        )
      : 0;

  const verifiedPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  return {
    totalCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    averageRating: avg,
    verifiedBuyerPercentage: verifiedPct,
  };
}
