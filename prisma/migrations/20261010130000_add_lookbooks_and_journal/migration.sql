-- CreateTable: lookbooks
CREATE TABLE "lookbooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "description" TEXT,
    "hero_image" TEXT NOT NULL,
    "hero_image_alt" TEXT,
    "status" "page_status" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lookbook_slides
CREATE TABLE "lookbook_slides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lookbook_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_alt" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookbook_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lookbook_hotspots
CREATE TABLE "lookbook_hotspots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slide_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookbook_hotspots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lookbook_hotspots_x_range" CHECK ("x" >= 0.0 AND "x" <= 100.0),
    CONSTRAINT "lookbook_hotspots_y_range" CHECK ("y" >= 0.0 AND "y" <= 100.0)
);

-- CreateTable: articles
CREATE TABLE "articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hero_image" TEXT NOT NULL,
    "hero_image_alt" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Editorial',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "author_name" TEXT NOT NULL DEFAULT 'Auren Atelier',
    "status" "page_status" NOT NULL DEFAULT 'draft',
    "read_time_minutes" INTEGER NOT NULL DEFAULT 3,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: article_products
CREATE TABLE "article_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "article_products_article_id_product_id_key" UNIQUE ("article_id", "product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lookbooks_slug_key" ON "lookbooks"("slug");
CREATE INDEX "lookbooks_status_sort_order_idx" ON "lookbooks"("status", "sort_order");
CREATE INDEX "lookbooks_season_idx" ON "lookbooks"("season");

CREATE INDEX "lookbook_slides_lookbook_id_sort_order_idx" ON "lookbook_slides"("lookbook_id", "sort_order");

CREATE INDEX "lookbook_hotspots_slide_id_idx" ON "lookbook_hotspots"("slide_id");
CREATE INDEX "lookbook_hotspots_product_id_idx" ON "lookbook_hotspots"("product_id");

CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at" DESC);
CREATE INDEX "articles_category_idx" ON "articles"("category");

CREATE INDEX "article_products_article_id_idx" ON "article_products"("article_id");
CREATE INDEX "article_products_product_id_idx" ON "article_products"("product_id");

-- AddForeignKeys
ALTER TABLE "lookbook_slides" ADD CONSTRAINT "lookbook_slides_lookbook_id_fkey" FOREIGN KEY ("lookbook_id") REFERENCES "lookbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lookbook_hotspots" ADD CONSTRAINT "lookbook_hotspots_slide_id_fkey" FOREIGN KEY ("slide_id") REFERENCES "lookbook_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lookbook_hotspots" ADD CONSTRAINT "lookbook_hotspots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_products" ADD CONSTRAINT "article_products_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_products" ADD CONSTRAINT "article_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security
SELECT public.auren_secure_table('lookbooks'::regclass);
SELECT public.auren_secure_table('lookbook_slides'::regclass);
SELECT public.auren_secure_table('lookbook_hotspots'::regclass);
SELECT public.auren_secure_table('articles'::regclass);
SELECT public.auren_secure_table('article_products'::regclass);

-- Seed initial Lookbook and Editorial Journal
DO $$
DECLARE
  lb_id UUID := gen_random_uuid();
  slide1_id UUID := gen_random_uuid();
  slide2_id UUID := gen_random_uuid();
  slide3_id UUID := gen_random_uuid();
  art1_id UUID := gen_random_uuid();
  art2_id UUID := gen_random_uuid();
  art3_id UUID := gen_random_uuid();
  p_oxford UUID;
  p_trouser UUID;
BEGIN
  SELECT id INTO p_oxford FROM "products" WHERE slug = 'oxford-button-down-shirt' LIMIT 1;
  SELECT id INTO p_trouser FROM "products" WHERE slug = 'tailored-linen-trouser' OR slug = 'pleated-wool-trousers' LIMIT 1;

  -- 1. Lookbook
  INSERT INTO "lookbooks" (
    "id", "title", "slug", "season", "description",
    "hero_image", "hero_image_alt", "status", "sort_order", "published_at"
  ) VALUES (
    lb_id,
    'Autumn / Winter 2026: Noble Textures',
    'autumn-winter-2026',
    'AW 2026',
    'An exploration of tactile warmth, sculptural drape, and architectural restraint. Shot on location across quiet limestone and brutalist concrete.',
    '/editorial/lookbook.jpg',
    'Auren Autumn Winter 2026 Editorial Curation',
    'published',
    1,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
  );

  -- Lookbook Slides
  INSERT INTO "lookbook_slides" ("id", "lookbook_id", "image_url", "image_alt", "title", "caption", "sort_order")
  VALUES
  (
    slide1_id, lb_id, '/editorial/lookbook.jpg',
    'Sculptural tailored silhouette in noble wool',
    'Frame I — The Tailored Transition',
    'Unstructured shoulders cut with clean vertical posture. Styled over heavy Oxford cotton with horn button closure.',
    1
  ),
  (
    slide2_id, lb_id, '/editorial/craft.jpg',
    'Tactile study of woven Irish linen and mother-of-pearl buttons',
    'Frame II — The Tactile Study',
    'Single-needle 22-stitch precision balancing natural slub with crisp collar discipline.',
    2
  ),
  (
    slide3_id, lb_id, '/editorial/materials.jpg',
    'Monochrome evening tailoring against limestone',
    'Frame III — Evening Monolith',
    'A tailored silhouette engineered for modern Dhaka climates and black-tie elegance.',
    3
  );

  -- Hotspots if products exist
  IF p_oxford IS NOT NULL THEN
    INSERT INTO "lookbook_hotspots" ("id", "slide_id", "product_id", "x", "y", "label")
    VALUES
    (gen_random_uuid(), slide1_id, p_oxford, 48.5, 36.2, 'Oxford Button-Down Shirt in Chalk'),
    (gen_random_uuid(), slide2_id, p_oxford, 52.0, 44.0, 'Hand-Stitched Collar Roll');
  END IF;

  IF p_trouser IS NOT NULL THEN
    INSERT INTO "lookbook_hotspots" ("id", "slide_id", "product_id", "x", "y", "label")
    VALUES
    (gen_random_uuid(), slide1_id, p_trouser, 46.0, 72.5, 'Tailored Trousers in Charcoal');
  END IF;

  -- 2. Editorial Journal Articles
  INSERT INTO "articles" (
    "id", "title", "slug", "excerpt", "content",
    "hero_image", "hero_image_alt", "category", "tags",
    "author_name", "status", "read_time_minutes", "published_at",
    "seo_title", "seo_description"
  ) VALUES
  (
    art1_id,
    'The Anatomy of Noble Linen: Why Natural Fibers Breathe in Dhaka',
    'the-anatomy-of-noble-linen',
    'A textile study into genuine Irish flax, flaxen cellulose mechanics, and why noble linen softens with age rather than degrades.',
    E'# The Anatomy of Noble Linen\n\nThere is a profound distinction between synthetic technical fabrics and natural cellulose spun from pure European flax. Where polyester traps moisture and creates static tension against the skin, long-staple flax possesses hollow core fibers that naturally breathe.\n\n> "A great garment does not fight the climate; it harmonizes with the temperature of the wearer."\n\n### The Irish Weaving Standard\n\nAt the Auren atelier, our linen is spun from certified Belgian and Irish flax fields. Each yarn is conditioned over four weeks to release natural tensions before passing onto low-tension looms. The result is a substantial 240 GSM drape that avoids the paper-thin frailty common in fast-fashion linen.\n\n### Living With Natural Slub\n\nUnlike chemical smoothing treatments, we celebrate the organic irregularities of the slub yarn. Over months of wear and gentle cold laundering, the pectin inside the fiber naturally releases, leaving the fabric softer, silkier, and increasingly comfortable with every passing season.',
    '/editorial/materials.jpg',
    'Pure unbleached Irish flax yarns on wooden looms',
    'Fabric Studies',
    ARRAY['Linen', 'Noble Fibers', 'Craftsmanship', 'Dhaka Heat'],
    'Auren Atelier',
    'published',
    4,
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    'The Anatomy of Noble Linen | AUREN Journal',
    'A textile study into genuine Irish flax, cellular breathability, and noble fiber longevity.'
  ),
  (
    art2_id,
    'The 22-Stitch Standard: Architecture of the Archetypal Button-Down',
    'the-22-stitch-standard',
    'Exploring the anatomy of a shirt collar that rolls rather than folds flat, hand-set mother-of-pearl buttons, and single-needle craftsmanship.',
    E'# The 22-Stitch Standard\n\nA shirt is judged not by its label, but by the clean integrity of its seams under tension. At 22 stitches per inch, seam puckering is eradicated, and the join between sleeve and body becomes a quiet architectural line.\n\n### The Collar Roll Philosophy\n\nMost modern shirts utilize heavy fusible interlinings that transform collars into cardboard stiffeners. We chose a soft, floating brushed-canvas interlining. When buttoned down, the collar points curve with a gentle roll reminiscent of mid-century Ivy tailoring, framing the collarbones with natural grace.\n\n### Genuine Australian Mother-of-Pearl\n\nPlastic resin buttons turn brittle and lose luster under iron heat. Our buttons are sliced from genuine Australian Pinctada maxima oyster shells, crossed with shank-wrapped thread so they never loosen or chip.',
    '/editorial/craft.jpg',
    'Tailor hand-setting mother-of-pearl buttons with silk thread',
    'Craft & Atelier',
    ARRAY['Tailoring', 'Collar Roll', 'Mother of Pearl', 'Savile Row'],
    'Sartorial Director',
    'published',
    5,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    'The 22-Stitch Standard | AUREN Journal',
    'Inside the tailoring workshop: floating interlinings, collar curves, and mother-of-pearl buttons.'
  ),
  (
    art3_id,
    'Monochrome Evening Tailoring: The Modern Dhaka Uniform',
    'monochrome-evening-tailoring',
    'Moving beyond traditional gala conventions: how midnight tones, unpadded shoulders, and fluid wool-cashmere elevate evening dress.',
    E'# Monochrome Evening Tailoring\n\nThe evening uniform for the modern metropolis is characterized by restraint. In lieu of glossy synthetic satin or rigid lapels, we advocate for tonal depth—deep charcoal, matte ink, and midnight blue woven with high-twist worsted wool.\n\n### Structure Without Stiffness\n\nAn evening spent in conversation demands movement. By removing stiff shoulder pads and chest canvas padding, the jacket drapes naturally with the body’s silhouette, providing bespoke confidence from sunset into late night.',
    '/editorial/lookbook.jpg',
    'Evening bespoke tailoring in charcoal worsted wool',
    'Style Notes',
    ARRAY['Eveningwear', 'Monochrome', 'Black Tie', 'Contemporary'],
    'Auren Atelier',
    'published',
    3,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'Monochrome Evening Tailoring | AUREN Journal',
    'A modern approach to evening tailoring with tonal depth and relaxed elegance.'
  );

  -- Link articles to featured products
  IF p_oxford IS NOT NULL THEN
    INSERT INTO "article_products" ("id", "article_id", "product_id", "sort_order")
    VALUES (gen_random_uuid(), art2_id, p_oxford, 1);
  END IF;

  IF p_trouser IS NOT NULL THEN
    INSERT INTO "article_products" ("id", "article_id", "product_id", "sort_order")
    VALUES (gen_random_uuid(), art1_id, p_trouser, 1);
  END IF;

END $$;
