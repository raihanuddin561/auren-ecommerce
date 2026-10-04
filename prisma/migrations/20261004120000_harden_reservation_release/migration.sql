-- The expiry job runs as the application role, which cannot execute functions unless granted
-- (20261003100000_secure_public_schema revokes EXECUTE from PUBLIC).
--
-- Also: levels are locked in (variant, location) order like every other stock writer, so the cron
-- can never deadlock with a checkout, and only checkout holds expire on their own. A hold that
-- belongs to an order is released by staff or by the order lifecycle, never by a timer (INV-O2,
-- INV-O11).
CREATE OR REPLACE FUNCTION "release_expired_reservations"(p_limit integer DEFAULT 500)
RETURNS TABLE ("released_variant_id" uuid, "released_quantity" integer)
LANGUAGE plpgsql AS $fn$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT s."id", s."variant_id", s."location_id", s."quantity", s."reference_type", s."reference_id"
    FROM "stock_reservations" s
    WHERE s."status" = 'active' AND s."expires_at" <= now() AND s."reference_type" = 'checkout'
    ORDER BY s."variant_id", s."location_id", s."id"
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE "inventory_levels" l
       SET "reserved" = l."reserved" - r."quantity", "updated_at" = now()
     WHERE l."variant_id" = r."variant_id" AND l."location_id" = r."location_id";
    UPDATE "stock_reservations" SET "status" = 'released', "resolved_at" = now() WHERE "id" = r."id";
    INSERT INTO "stock_movements" ("id", "variant_id", "location_id", "type", "quantity", "reference_type", "reference_id", "reason")
    VALUES (gen_random_uuid(), r."variant_id", r."location_id", 'release', -r."quantity", r."reference_type", r."reference_id", 'reservation expired');
    "released_variant_id" := r."variant_id";
    "released_quantity" := r."quantity";
    RETURN NEXT;
  END LOOP;
END
$fn$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    GRANT EXECUTE ON FUNCTION "release_expired_reservations"(integer) TO "auren_app";
  END IF;
END
$$;
