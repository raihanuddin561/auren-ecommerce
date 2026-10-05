-- Human-facing order numbers (AUR-100001). Created first: the orders table defaults to it.
CREATE SEQUENCE "order_number_seq" START 100001;

-- CreateEnum
CREATE TYPE "geo_level" AS ENUM ('division', 'district', 'thana', 'area');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending_payment', 'payment_expired', 'placed', 'under_verification', 'on_hold', 'confirmed', 'processing', 'shipped', 'delivered', 'delivery_failed', 'returned_to_origin', 'completed', 'return_requested', 'returned', 'refunded', 'exchanged', 'cancelled');

-- CreateEnum
CREATE TYPE "order_payment_status" AS ENUM ('unpaid', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "order_fulfillment_status" AS ENUM ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned');

-- CreateEnum
CREATE TYPE "order_channel" AS ENUM ('web', 'manual', 'facebook', 'instagram', 'whatsapp', 'store');

-- CreateEnum
CREATE TYPE "payment_record_status" AS ENUM ('initiated', 'pending', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "risk_flag_type" AS ENUM ('fake_order', 'repeat_rto', 'abusive', 'manual');

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "token_hash" TEXT,
    "user_id" UUID,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_areas" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "level" "geo_level" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_bn" TEXT,
    "courier_codes" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "division_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "thana_id" UUID,
    "thana_name" TEXT,
    "area" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "postal_code" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'BD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "geo_area_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "free_over_minor" BIGINT,
    "min_days" INTEGER NOT NULL,
    "max_days" INTEGER NOT NULL,
    "cod_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL DEFAULT ('AUR-'::text || nextval('order_number_seq'::regclass)),
    "user_id" UUID,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'placed',
    "payment_status" "order_payment_status" NOT NULL DEFAULT 'unpaid',
    "fulfillment_status" "order_fulfillment_status" NOT NULL DEFAULT 'unfulfilled',
    "channel" "order_channel" NOT NULL DEFAULT 'web',
    "currency" CHAR(3) NOT NULL,
    "subtotal_minor" BIGINT NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "shipping_charged_minor" BIGINT NOT NULL,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL,
    "paid_minor" BIGINT NOT NULL DEFAULT 0,
    "refunded_minor" BIGINT NOT NULL DEFAULT 0,
    "shipping_address" JSONB NOT NULL,
    "billing_address" JSONB,
    "shipping_method" JSONB NOT NULL,
    "discount_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customer_note" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "utm" JSONB,
    "tracking_token_hash" TEXT NOT NULL,
    "address_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancel_reason" TEXT,
    "cancel_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "variant_title_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "options_snapshot" JSONB NOT NULL,
    "image_snapshot" TEXT,
    "unit_price_minor" BIGINT NOT NULL,
    "compare_at_minor" BIGINT,
    "unit_cost_minor" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL,
    "quantity_returned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "fee_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "status" "payment_record_status" NOT NULL DEFAULT 'initiated',
    "provider_ref" TEXT,
    "provider_session_id" TEXT,
    "idempotency_key" TEXT,
    "raw" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_risk_flags" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "user_id" UUID,
    "type" "risk_flag_type" NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "to_masked" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider_ref" TEXT,
    "error" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_token_hash_key" ON "carts"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at");

-- CreateIndex
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_variant_id_key" ON "cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "geo_areas_code_key" ON "geo_areas"("code");

-- CreateIndex
CREATE INDEX "geo_areas_parent_id_level_idx" ON "geo_areas"("parent_id", "level");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "shipping_rates_zone_id_idx" ON "shipping_rates"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_token_hash_key" ON "orders"("tracking_token_hash");

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_placed_at_idx" ON "orders"("placed_at" DESC);

-- CreateIndex
CREATE INDEX "orders_phone_status_idx" ON "orders"("phone", "status");

-- CreateIndex
CREATE INDEX "orders_address_hash_status_idx" ON "orders"("address_hash", "status");

-- CreateIndex
CREATE INDEX "orders_ip_hash_placed_at_idx" ON "orders"("ip_hash", "placed_at");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_assigned_to_status_idx" ON "orders"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "orders_delivered_at_idx" ON "orders"("delivered_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "customer_risk_flags_phone_idx" ON "customer_risk_flags"("phone");

-- CreateIndex
CREATE INDEX "notification_logs_related_type_related_id_idx" ON "notification_logs"("related_type", "related_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_areas" ADD CONSTRAINT "geo_areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "geo_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "shipping_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "carts" ADD CONSTRAINT "carts_owner_check"
  CHECK ("token_hash" IS NOT NULL OR "user_id" IS NOT NULL);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_check"
  CHECK ("quantity" >= 1 AND "quantity" <= 50);

-- Divisions are the roots; every other level has a parent.
ALTER TABLE "geo_areas" ADD CONSTRAINT "geo_areas_parent_check"
  CHECK (("level" = 'division') = ("parent_id" IS NULL));

-- Exactly one zone can be the fallback that catches every address no other zone claims.
CREATE UNIQUE INDEX "shipping_zones_one_fallback_idx" ON "shipping_zones" ("is_fallback") WHERE "is_fallback";
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_check"
  CHECK ("rate_minor" >= 0 AND ("free_over_minor" IS NULL OR "free_over_minor" > 0)
         AND "min_days" >= 0 AND "max_days" >= "min_days");

-- Money is never negative, and the total is exactly subtotal - discount + shipping (INV-M4).
-- The VAT in `tax_minor` is already inside the prices (tax inclusive), so it is not added again.
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_check"
  CHECK ("subtotal_minor" >= 0 AND "discount_minor" >= 0 AND "discount_minor" <= "subtotal_minor"
         AND "shipping_charged_minor" >= 0 AND "tax_minor" >= 0 AND "total_minor" >= 0
         AND "total_minor" = "subtotal_minor" - "discount_minor" + "shipping_charged_minor"
         AND "paid_minor" >= 0 AND "refunded_minor" >= 0 AND "refunded_minor" <= "paid_minor");
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancel_reason_check"
  CHECK ("cancel_reason" IS NULL OR "cancel_reason" IN
    ('customer_cancelled', 'fake_order', 'unreachable', 'out_of_stock', 'duplicate',
     'address_unserviceable', 'payment_failed', 'other'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

-- INV-O9: no order is past verification without a verifier and a time. The trigger below checks
-- that the verifier is an active staff member who may verify, and that it never changes.
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_requires_verifier_check"
  CHECK (
    "status" NOT IN ('confirmed', 'processing', 'shipped', 'delivered', 'delivery_failed',
                     'returned_to_origin', 'completed', 'return_requested', 'returned',
                     'refunded', 'exchanged')
    OR ("confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
  );

CREATE FUNCTION "orders_guard_confirmation"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."confirmed_by" IS NOT NULL
     AND NEW."confirmed_by" IS DISTINCT FROM OLD."confirmed_by" THEN
    RAISE EXCEPTION 'orders.confirmed_by cannot be changed once set' USING ERRCODE = '23514';
  END IF;
  IF NEW."confirmed_by" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."confirmed_by" IS NULL) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "staff_members" s
      WHERE s."id" = NEW."confirmed_by" AND s."active"
        AND (s."role" = 'owner' OR EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role" = s."role" AND rp."permission" = 'orders.verify'))
    ) THEN
      RAISE EXCEPTION 'orders.confirmed_by must be an active staff member who may verify orders'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER "orders_guard_confirmation_trg"
  BEFORE INSERT OR UPDATE ON "orders" FOR EACH ROW EXECUTE FUNCTION "orders_guard_confirmation"();

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_check"
  CHECK ("quantity" > 0 AND "unit_price_minor" >= 0 AND "unit_cost_minor" >= 0
         AND "discount_minor" >= 0 AND "tax_minor" >= 0 AND "quantity_returned" >= 0
         AND "quantity_returned" <= "quantity"
         AND "total_minor" = "unit_price_minor" * "quantity" - "discount_minor");
ALTER TABLE "payments" ADD CONSTRAINT "payments_amounts_check"
  CHECK ("amount_minor" >= 0 AND "fee_minor" >= 0);

-- ---------------------------------------------------------------------------------------------
-- Append-only ledgers and records that are never deleted
-- ---------------------------------------------------------------------------------------------

CREATE TRIGGER "order_events_append_only_trg"
  BEFORE UPDATE OR DELETE ON "order_events" FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "order_events_no_truncate_trg"
  BEFORE TRUNCATE ON "order_events" FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "notification_logs_append_only_trg"
  BEFORE UPDATE OR DELETE ON "notification_logs" FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "notification_logs_no_truncate_trg"
  BEFORE TRUNCATE ON "notification_logs" FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    REVOKE UPDATE, DELETE ON TABLE "order_events", "notification_logs" FROM "auren_app";
    -- Orders, their lines and their payments are corrected, cancelled or refunded, never deleted.
    REVOKE DELETE ON TABLE "orders", "order_items", "payments" FROM "auren_app";
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security on every new table (see public.auren_secure_table)
-- ---------------------------------------------------------------------------------------------

SELECT public.auren_secure_table('carts'::regclass);
SELECT public.auren_secure_table('cart_items'::regclass);
SELECT public.auren_secure_table('geo_areas'::regclass);
SELECT public.auren_secure_table('addresses'::regclass);
SELECT public.auren_secure_table('shipping_zones'::regclass);
SELECT public.auren_secure_table('shipping_rates'::regclass);
SELECT public.auren_secure_table('orders'::regclass);
SELECT public.auren_secure_table('order_items'::regclass);
SELECT public.auren_secure_table('order_events'::regclass);
SELECT public.auren_secure_table('payments'::regclass);
SELECT public.auren_secure_table('customer_risk_flags'::regclass);
SELECT public.auren_secure_table('notification_logs'::regclass);
