-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "fit_feedback" AS ENUM ('runs_small', 'true_to_size', 'runs_large');

-- CreateTable: reviews
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "order_item_id" UUID,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fit_feedback" "fit_feedback" NOT NULL DEFAULT 'true_to_size',
    "size_purchased" TEXT,
    "height_cm" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "moderated_by" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "moderation_note" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- CreateTable: review_media
CREATE TABLE "review_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_rating_stats
CREATE TABLE "product_rating_stats" (
    "product_id" UUID NOT NULL,
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "fit_runs_small_count" INTEGER NOT NULL DEFAULT 0,
    "fit_true_to_size_count" INTEGER NOT NULL DEFAULT 0,
    "fit_runs_large_count" INTEGER NOT NULL DEFAULT 0,
    "one_star_count" INTEGER NOT NULL DEFAULT 0,
    "two_star_count" INTEGER NOT NULL DEFAULT 0,
    "three_star_count" INTEGER NOT NULL DEFAULT 0,
    "four_star_count" INTEGER NOT NULL DEFAULT 0,
    "five_star_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_rating_stats_pkey" PRIMARY KEY ("product_id")
);

-- CreateIndex
CREATE INDEX "reviews_product_id_status_published_at_idx" ON "reviews"("product_id", "status", "published_at" DESC);
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at" DESC);
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");
CREATE INDEX "reviews_order_item_id_idx" ON "reviews"("order_item_id");
CREATE INDEX "review_media_review_id_sort_order_idx" ON "review_media"("review_id", "sort_order");

-- AddForeignKeys
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_rating_stats" ADD CONSTRAINT "product_rating_stats_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
SELECT public.auren_secure_table('reviews'::regclass);
SELECT public.auren_secure_table('review_media'::regclass);
SELECT public.auren_secure_table('product_rating_stats'::regclass);

-- Seed initial reviews for development catalog pieces
DO $$
DECLARE
  p_oxford UUID;
  p_trouser UUID;
  r1 UUID;
  r2 UUID;
  r3 UUID;
BEGIN
  SELECT id INTO p_oxford FROM "products" WHERE slug = 'oxford-button-down-shirt' LIMIT 1;
  SELECT id INTO p_trouser FROM "products" WHERE slug = 'tailored-linen-trouser' OR slug = 'pleated-wool-trousers' LIMIT 1;

  IF p_oxford IS NOT NULL THEN
    r1 := gen_random_uuid();
    r2 := gen_random_uuid();

    INSERT INTO "reviews" (
      "id", "product_id", "author_name", "rating", "title", "body",
      "fit_feedback", "size_purchased", "height_cm", "is_verified", "status", "published_at"
    ) VALUES
    (
      r1, p_oxford, 'Kazi Tanvir', 5,
      'Impeccable collar roll and noble drape',
      'The brushed Egyptian cotton feels substantial yet breathable in Dhaka heat. The collar roll frames a knit tie or unbuttoned look effortlessly. True to European sizing.',
      'true_to_size', 'L', 182, true, 'approved', CURRENT_TIMESTAMP - INTERVAL '3 days'
    ),
    (
      r2, p_oxford, 'Shakib Al-Mahmud', 5,
      'Atelier quality exceeding Savile Row RTW',
      'Mother-of-pearl buttons, single-needle stitching throughout, and sleeves that hit precisely at the wrist bone. Doorstep fit exchange gave absolute peace of mind.',
      'true_to_size', 'M', 175, true, 'approved', CURRENT_TIMESTAMP - INTERVAL '1 day'
    );

    INSERT INTO "product_rating_stats" (
      "product_id", "average_rating", "review_count",
      "fit_runs_small_count", "fit_true_to_size_count", "fit_runs_large_count",
      "one_star_count", "two_star_count", "three_star_count", "four_star_count", "five_star_count",
      "updated_at"
    ) VALUES (
      p_oxford, 5.0, 2,
      0, 2, 0,
      0, 0, 0, 0, 2,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("product_id") DO UPDATE SET
      "average_rating" = 5.0,
      "review_count" = 2,
      "fit_true_to_size_count" = 2,
      "five_star_count" = 2,
      "updated_at" = CURRENT_TIMESTAMP;
  END IF;

  IF p_trouser IS NOT NULL THEN
    r3 := gen_random_uuid();

    INSERT INTO "reviews" (
      "id", "product_id", "author_name", "rating", "title", "body",
      "fit_feedback", "size_purchased", "height_cm", "is_verified", "status", "published_at"
    ) VALUES
    (
      r3, p_trouser, 'Farhan Chowdhury', 5,
      'Natural waist rise and cleanest break',
      'The forward pleats create an elegant drape. The side adjusters remove any need for a belt, keeping the silhouette clean.',
      'true_to_size', '32', 178, true, 'approved', CURRENT_TIMESTAMP - INTERVAL '2 days'
    );

    INSERT INTO "product_rating_stats" (
      "product_id", "average_rating", "review_count",
      "fit_runs_small_count", "fit_true_to_size_count", "fit_runs_large_count",
      "one_star_count", "two_star_count", "three_star_count", "four_star_count", "five_star_count",
      "updated_at"
    ) VALUES (
      p_trouser, 5.0, 1,
      0, 1, 0,
      0, 0, 0, 0, 1,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("product_id") DO UPDATE SET
      "average_rating" = 5.0,
      "review_count" = 1,
      "fit_true_to_size_count" = 1,
      "five_star_count" = 1,
      "updated_at" = CURRENT_TIMESTAMP;
  END IF;
END $$;
