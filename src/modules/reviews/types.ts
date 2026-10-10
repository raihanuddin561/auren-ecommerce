export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type FitFeedback = 'runs_small' | 'true_to_size' | 'runs_large';

export interface ReviewMediaItem {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
}

export interface ReviewItem {
  id: string;
  productId: string;
  productTitle?: string;
  productSlug?: string;
  userId?: string | null;
  orderItemId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  rating: number;
  title: string;
  body: string;
  fitFeedback: FitFeedback;
  sizePurchased?: string | null;
  heightCm?: number | null;
  isVerified: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  moderationNote?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  media: ReviewMediaItem[];
}

export interface ProductRatingStatsData {
  productId: string;
  averageRating: number;
  reviewCount: number;
  fitRunsSmallCount: number;
  fitTrueToSizeCount: number;
  fitRunsLargeCount: number;
  fitTrueToSizePercentage: number;
  oneStarCount: number;
  twoStarCount: number;
  threeStarCount: number;
  fourStarCount: number;
  fiveStarCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface SubmitReviewInput {
  productId: string;
  rating: number;
  title: string;
  body: string;
  fitFeedback: FitFeedback;
  sizePurchased?: string;
  heightCm?: number;
  authorName: string;
  authorEmail?: string;
  mediaUrls?: string[];
  orderItemId?: string;
}

export interface ModerateReviewInput {
  reviewId: string;
  status: 'approved' | 'rejected';
  moderationNote?: string;
}

export interface ReviewFilterParams {
  rating?: number;
  hasMedia?: boolean;
  fitFeedback?: FitFeedback;
  sort?: 'recent' | 'rating_desc' | 'rating_asc' | 'helpful';
  limit?: number;
  offset?: number;
}

export interface AdminReviewFilterParams {
  status?: ReviewStatus | 'all';
  productId?: string;
  rating?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminReviewsResult {
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminReviewsOverviewMetrics {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageRating: number;
  verifiedBuyerPercentage: number;
}
