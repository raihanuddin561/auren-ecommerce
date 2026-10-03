-- Rules the application enforces, repeated in the database so raw SQL or a later module cannot
-- break them.

-- A redirect target stays on this site: one leading slash, no backslash, no scheme.
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_to_path_safe_check"
  CHECK ("to_path" ~ '^/[^/\\]');

-- An active variant is sellable, so it has a price above zero.
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_active_price_check"
  CHECK ("status" <> 'active' OR "price_minor" > 0);
