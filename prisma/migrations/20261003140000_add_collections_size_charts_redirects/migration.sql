-- Catalogue admin: size charts, collections (manual and automatic), slug redirects, category image alt.
-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "image_alt" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "size_chart_id" UUID;

-- CreateTable
CREATE TABLE "size_charts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cm',
    "table" JSONB NOT NULL DEFAULT '{}',
    "how_to_measure" TEXT,
    "model_info" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "size_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hero_media" JSONB,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "sort_order" TEXT NOT NULL DEFAULT 'manual',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_products" (
    "collection_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_products_pkey" PRIMARY KEY ("collection_id","product_id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- CreateIndex
CREATE INDEX "collections_published_at_idx" ON "collections"("published_at");

-- CreateIndex
CREATE INDEX "collection_products_product_id_idx" ON "collection_products"("product_id");

-- CreateIndex
CREATE INDEX "collection_products_collection_id_position_idx" ON "collection_products"("collection_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- CreateIndex
CREATE INDEX "redirects_to_path_idx" ON "redirects"("to_path");

-- CreateIndex
CREATE INDEX "products_size_chart_id_idx" ON "products"("size_chart_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_size_chart_id_fkey" FOREIGN KEY ("size_chart_id") REFERENCES "size_charts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Constraints the application also enforces, stated once more in the database.
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_unit_check" CHECK ("unit" IN ('cm', 'in'));
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "collections" ADD CONSTRAINT "collections_type_check" CHECK ("type" IN ('manual', 'automatic'));
ALTER TABLE "collections" ADD CONSTRAINT "collections_sort_order_check"
  CHECK ("sort_order" IN ('manual', 'best_selling', 'newest', 'price_asc', 'price_desc'));
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_check"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_position_check" CHECK ("position" >= 0);

ALTER TABLE "redirects" ADD CONSTRAINT "redirects_status_code_check" CHECK ("status_code" IN (301, 302));
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_paths_check"
  CHECK ("from_path" LIKE '/%' AND "to_path" LIKE '/%' AND "from_path" <> "to_path");
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_hits_check" CHECK ("hits" >= 0);

-- Row level security on every new table (see public.auren_secure_table).
SELECT public.auren_secure_table('size_charts'::regclass);
SELECT public.auren_secure_table('collections'::regclass);
SELECT public.auren_secure_table('collection_products'::regclass);
SELECT public.auren_secure_table('redirects'::regclass);
