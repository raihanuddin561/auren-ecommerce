-- CreateEnum
CREATE TYPE "page_status" AS ENUM ('draft', 'published', 'scheduled', 'archived');

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "page_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "scheduled_at" TIMESTAMPTZ(6),
    "seo_title" TEXT,
    "seo_description" TEXT,
    "og_image_url" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page_id" UUID NOT NULL,
    "block_type" TEXT NOT NULL,
    "name" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");
CREATE INDEX "pages_status_idx" ON "pages"("status");
CREATE INDEX "page_sections_page_id_sort_order_idx" ON "page_sections"("page_id", "sort_order");

-- AddForeignKey
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (public.auren_secure_table)
SELECT public.auren_secure_table('pages'::regclass);
SELECT public.auren_secure_table('page_sections'::regclass);

-- Seed default editorial pages with section blocks if not exists
INSERT INTO "pages" ("id", "slug", "title", "description", "status", "published_at", "seo_title", "seo_description")
VALUES 
  (
    '01927380-0001-7000-8000-000000000001',
    'atelier-craftsmanship',
    'The Atelier & Sartorial Craft',
    'Inside the Auren bespoke tailoring workshop, noble fibers, and artisanal standards.',
    'published',
    CURRENT_TIMESTAMP,
    'The Atelier & Sartorial Craft | AUREN',
    'Discover Auren''s dedication to fine sartorial craft, bespoke suiting, and master tailoring in Banani, Dhaka.'
  ),
  (
    '01927380-0002-7000-8000-000000000002',
    'private-commissions',
    'Private Client Commissions',
    'Bespoke consultations, custom fabric sourcing, and private fittings.',
    'published',
    CURRENT_TIMESTAMP,
    'Private Client Commissions & Bespoke Styling | AUREN',
    'Experience our private concierge appointments and bespoke tailoring services.'
  )
ON CONFLICT ("slug") DO NOTHING;

-- Seed sample blocks for atelier-craftsmanship page
INSERT INTO "page_sections" ("id", "page_id", "block_type", "name", "props", "sort_order", "is_visible")
VALUES
  (
    '01927380-0001-7000-8000-000000000011',
    '01927380-0001-7000-8000-000000000001',
    'hero_banner',
    'Atelier Master Hero',
    '{
      "headline": "The Art of Slow Elegance",
      "subtitle": "Every seam deliberate. Every silhouette cut from noble fibers harvested across heritage mills.",
      "ctaLabel": "Explore The Collection",
      "ctaUrl": "/shop",
      "theme": "ink"
    }',
    0,
    true
  ),
  (
    '01927380-0001-7000-8000-000000000012',
    '01927380-0001-7000-8000-000000000001',
    'editorial_quote',
    'Philosophy Quote',
    '{
      "quote": "True luxury does not clamor for attention. It speaks in the subtle drape of Egyptian Giza cotton and hand-rolled pick stitching.",
      "author": "Atelier Direction",
      "title": "Auren Sartorial House"
    }',
    1,
    true
  ),
  (
    '01927380-0001-7000-8000-000000000013',
    '01927380-0001-7000-8000-000000000001',
    'brand_perks',
    'Noble Fibers & Perks',
    '{
      "headline": "The Atelier Commitments",
      "subtitle": "Uncompromising garment construction and lifelong client care.",
      "items": [
        {"icon": "Sparkles", "title": "Artisanal Tailoring", "description": "Hand-stitched canvas construction and reinforced buttonholes."},
        {"icon": "ShieldCheck", "title": "Noble Fiber Certified", "description": "100% genuine Giza cotton, Italian wool, and French flax linen."},
        {"icon": "Truck", "title": "White-Glove Delivery", "description": "Direct Banani dispatch with 7-day doorstep trial and exchanges."}
      ]
    }',
    2,
    true
  ),
  (
    '01927380-0001-7000-8000-000000000014',
    '01927380-0001-7000-8000-000000000001',
    'newsletter_strip',
    'Inner Circle Newsletter',
    '{
      "headline": "Join The Atelier Circle",
      "subtitle": "Privileged previews of seasonal capsule releases and private styling salons.",
      "buttonLabel": "Request Access"
    }',
    3,
    true
  )
ON CONFLICT ("id") DO NOTHING;
