-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y');

-- CreateEnum
CREATE TYPE "discount_applies_to" AS ENUM ('order', 'products', 'collections', 'categories');

-- CreateEnum
CREATE TYPE "discount_customer_eligibility" AS ENUM ('all', 'new', 'segment');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN "discount_code" CITEXT;

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "code" CITEXT,
    "title" TEXT NOT NULL,
    "type" "discount_type" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "applies_to" "discount_applies_to" NOT NULL DEFAULT 'order',
    "target_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "min_subtotal_minor" BIGINT,
    "min_quantity" INTEGER,
    "max_discount_minor" BIGINT,
    "customer_eligibility" "discount_customer_eligibility" NOT NULL DEFAULT 'all',
    "usage_limit" INTEGER,
    "usage_limit_per_customer" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "combinable" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_redemptions" (
    "id" UUID NOT NULL,
    "discount_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID,
    "phone" TEXT,
    "amount_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_code_idx" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_is_active_starts_at_ends_at_idx" ON "discounts"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "discount_redemptions_discount_id_idx" ON "discount_redemptions"("discount_id");

-- CreateIndex
CREATE INDEX "discount_redemptions_order_id_idx" ON "discount_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "discount_redemptions_user_id_idx" ON "discount_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "discount_redemptions_phone_idx" ON "discount_redemptions"("phone");

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Constraints
ALTER TABLE "discounts"
  ADD CONSTRAINT "discounts_usage_count_nonnegative" CHECK ("usage_count" >= 0),
  ADD CONSTRAINT "discounts_usage_limit_positive" CHECK ("usage_limit" IS NULL OR "usage_limit" > 0),
  ADD CONSTRAINT "discounts_usage_limit_per_customer_positive" CHECK ("usage_limit_per_customer" IS NULL OR "usage_limit_per_customer" > 0),
  ADD CONSTRAINT "discounts_min_subtotal_minor_nonnegative" CHECK ("min_subtotal_minor" IS NULL OR "min_subtotal_minor" >= 0),
  ADD CONSTRAINT "discounts_max_discount_minor_positive" CHECK ("max_discount_minor" IS NULL OR "max_discount_minor" > 0),
  ADD CONSTRAINT "discounts_value_nonnegative" CHECK ("value" >= 0);

ALTER TABLE "discount_redemptions"
  ADD CONSTRAINT "discount_redemptions_amount_minor_nonnegative" CHECK ("amount_minor" >= 0);

-- Row level security on every new table (see public.auren_secure_table)
SELECT public.auren_secure_table('discounts'::regclass);
SELECT public.auren_secure_table('discount_redemptions'::regclass);
