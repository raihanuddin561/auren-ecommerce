-- Media moves from Cloudinary to Vercel Blob (production) and local files (development), ADR-026.
-- product_media records where a file lives and what it is. `static` rows are files shipped with the
-- app (the development placeholders under public/seed); real uploads are `local` or `vercel-blob`
-- and must carry a storage key, a content type and a size. SVG is not an allowed content type.
ALTER TABLE "product_media" RENAME COLUMN "provider_public_id" TO "storage_key";
ALTER TABLE "product_media" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'static';
ALTER TABLE "product_media" ADD COLUMN "content_type" TEXT;
ALTER TABLE "product_media" ADD COLUMN "size_bytes" INTEGER;

ALTER TABLE "product_media" ADD CONSTRAINT "product_media_provider_check"
  CHECK ("provider" IN ('static', 'local', 'vercel-blob'));
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_content_type_check"
  CHECK ("content_type" IS NULL OR "content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif'));
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_size_check"
  CHECK ("size_bytes" IS NULL OR "size_bytes" > 0);
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_upload_check"
  CHECK ("provider" = 'static' OR ("storage_key" IS NOT NULL AND "content_type" IS NOT NULL AND "size_bytes" IS NOT NULL));

-- The database also refuses what the application should never write: a key that is not one of ours
-- (public keys are images, never under private/) and a URL that does not match its provider.
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_storage_key_check"
  CHECK ("storage_key" IS NULL OR "storage_key" ~ '^[a-z0-9][a-z0-9-]{0,40}/[A-Za-z0-9_-]{20,64}\.(jpg|png|webp|avif)$');
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_url_provider_check"
  CHECK (
    ("provider" = 'vercel-blob' AND "url" ~ '^https://[a-z0-9]+\.public\.blob\.vercel-storage\.com/')
    OR ("provider" = 'local' AND "url" LIKE '/api/media/%')
    OR "provider" = 'static'
  );
