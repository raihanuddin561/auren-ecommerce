CREATE SEQUENCE "return_number_seq" START 1;

-- CreateEnum
CREATE TYPE "verification_channel" AS ENUM ('call', 'sms', 'whatsapp', 'messenger');

-- CreateEnum
CREATE TYPE "verification_outcome" AS ENUM ('verified', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'customer_cancelled', 'suspected_fake', 'order_edited');

-- CreateEnum
CREATE TYPE "order_cost_type" AS ENUM ('shipping', 'gateway_fee', 'cod_fee', 'packaging', 'return_shipping', 'rto_loss', 'other');

-- CreateEnum
CREATE TYPE "refund_method" AS ENUM ('original', 'store_credit', 'manual_bkash');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('requested', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "courier_id" AS ENUM ('pathao', 'steadfast', 'manual');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('pending', 'booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned');

-- CreateEnum
CREATE TYPE "shipment_kind" AS ENUM ('outbound', 'replacement');

-- CreateEnum
CREATE TYPE "return_type" AS ENUM ('return', 'exchange');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('requested', 'approved', 'rejected', 'in_transit', 'received', 'inspected', 'refunded', 'exchanged', 'closed');

-- CreateEnum
CREATE TYPE "return_resolution" AS ENUM ('refund', 'store_credit', 'exchange');

-- CreateEnum
CREATE TYPE "return_reason" AS ENUM ('too_small', 'too_large', 'defective', 'not_as_described', 'changed_mind');

-- CreateEnum
CREATE TYPE "return_condition" AS ENUM ('resellable', 'damaged');

-- CreateEnum
CREATE TYPE "store_credit_reason" AS ENUM ('return', 'goodwill', 'redeem');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "claim_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "escalated_at" TIMESTAMPTZ(6),
ADD COLUMN     "needs_manager_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returned_to_origin_at" TIMESTAMPTZ(6),
ADD COLUMN     "shipped_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "replacement_of_item_id" UUID;

-- CreateTable
CREATE TABLE "order_verification_attempts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "channel" "verification_channel" NOT NULL DEFAULT 'call',
    "outcome" "verification_outcome" NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "next_attempt_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cost_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" "order_cost_type" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "return_request_id" UUID,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "method" "refund_method" NOT NULL DEFAULT 'manual_bkash',
    "status" "refund_status" NOT NULL DEFAULT 'requested',
    "provider_ref" TEXT,
    "note" TEXT,
    "requested_by" UUID,
    "actor_id" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "kind" "shipment_kind" NOT NULL DEFAULT 'outbound',
    "courier" "courier_id" NOT NULL,
    "courier_name" TEXT,
    "tracking_number" TEXT,
    "consignment_id" TEXT,
    "status" "shipment_status" NOT NULL DEFAULT 'pending',
    "cod_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "cost_minor" BIGINT NOT NULL DEFAULT 0,
    "cod_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "weight_g" INTEGER,
    "label_url" TEXT,
    "booked_by" UUID,
    "booked_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_id" TEXT,
    "actor_id" UUID,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packaging_profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cost_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "packaging_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "return_number" TEXT NOT NULL DEFAULT ('RET-'::text || lpad((nextval('return_number_seq'::regclass))::text, 4, '0'::text)),
    "order_id" UUID NOT NULL,
    "type" "return_type" NOT NULL DEFAULT 'return',
    "status" "return_status" NOT NULL DEFAULT 'requested',
    "customer_note" TEXT,
    "staff_note" TEXT,
    "resolution" "return_resolution",
    "return_shipping_cost_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "requested_by" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "inspected_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "return_reason" NOT NULL,
    "condition" "return_condition",
    "exchange_variant_id" UUID,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credit_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" "store_credit_reason" NOT NULL,
    "reference_id" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_verification_attempts_order_id_created_at_idx" ON "order_verification_attempts"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_verification_attempts_staff_id_created_at_idx" ON "order_verification_attempts"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "order_cost_lines_order_id_idx" ON "order_cost_lines"("order_id");

-- CreateIndex
CREATE INDEX "order_cost_lines_created_at_idx" ON "order_cost_lines"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_courier_tracking_number_idx" ON "shipments"("courier", "tracking_number");

-- CreateIndex
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_events_shipment_id_external_id_key" ON "shipment_events"("shipment_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_return_number_key" ON "return_requests"("return_number");

-- CreateIndex
CREATE INDEX "return_requests_order_id_idx" ON "return_requests"("order_id");

-- CreateIndex
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "return_items_order_item_id_idx" ON "return_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_return_id_order_item_id_key" ON "return_items"("return_id", "order_item_id");

-- CreateIndex
CREATE INDEX "store_credit_ledger_user_id_created_at_idx" ON "store_credit_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_next_attempt_at_idx" ON "orders"("next_attempt_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_replacement_of_item_id_fkey" FOREIGN KEY ("replacement_of_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_verification_attempts" ADD CONSTRAINT "order_verification_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_verification_attempts" ADD CONSTRAINT "order_verification_attempts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cost_lines" ADD CONSTRAINT "order_cost_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_ledger" ADD CONSTRAINT "store_credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Rules the database enforces on its own (hand written; Prisma cannot express them)
-- ---------------------------------------------------------------------------------------------

-- Order costs: automatic lines are never negative, only a reversing `other` line may be; one
-- automatic line per source, so recording the same cost twice changes nothing.
ALTER TABLE "order_cost_lines" ADD CONSTRAINT "order_cost_lines_amount_check"
  CHECK ("amount_minor" <> 0 AND ("type" = 'other' OR "amount_minor" > 0)
         AND "currency" ~ '^[A-Z]{3}$');
CREATE UNIQUE INDEX "order_cost_lines_source_key"
  ON "order_cost_lines" ("order_id", "type", "source_type", "source_id")
  WHERE "source_id" IS NOT NULL;

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check"
  CHECK ("amount_minor" > 0 AND "currency" ~ '^[A-Z]{3}$'
         AND (("status" = 'succeeded') = ("processed_at" IS NOT NULL)));

-- A refund can never exceed what was captured (INV-P4): the sum of open and succeeded refunds on a
-- payment stays within the payment amount, and a succeeded refund needs a succeeded payment. The
-- payment row is locked for the check, so two refunds at once cannot both slip through.
CREATE FUNCTION "refunds_guard_amount"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  captured bigint;
  pay_status text;
  already bigint;
BEGIN
  IF NEW."status" IN ('failed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  SELECT p."amount_minor", p."status"::text INTO captured, pay_status
    FROM "payments" p WHERE p."id" = NEW."payment_id" FOR UPDATE;
  IF captured IS NULL THEN
    RAISE EXCEPTION 'refund refers to an unknown payment' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'succeeded' AND pay_status <> 'succeeded' THEN
    RAISE EXCEPTION 'a refund needs a payment that was captured' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(r."amount_minor"), 0) INTO already
    FROM "refunds" r
   WHERE r."payment_id" = NEW."payment_id" AND r."status" IN ('requested', 'succeeded')
     AND r."id" <> NEW."id";
  IF already + NEW."amount_minor" > captured THEN
    RAISE EXCEPTION 'refunds would exceed the captured amount' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER "refunds_guard_amount_trg"
  BEFORE INSERT OR UPDATE OF "amount_minor", "status", "payment_id" ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION "refunds_guard_amount"();

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_amounts_check"
  CHECK ("cod_amount_minor" >= 0 AND "cost_minor" >= 0 AND "cod_fee_minor" >= 0
         AND "currency" ~ '^[A-Z]{3}$' AND ("weight_g" IS NULL OR "weight_g" > 0));
-- One live outbound parcel per order: a failed or returned one can be followed by a new booking.
CREATE UNIQUE INDEX "shipments_one_live_outbound_key"
  ON "shipments" ("order_id") WHERE "kind" = 'outbound' AND "status" NOT IN ('failed', 'returned');

ALTER TABLE "packaging_profiles" ADD CONSTRAINT "packaging_profiles_cost_check"
  CHECK ("cost_minor" >= 0 AND "currency" ~ '^[A-Z]{3}$');
CREATE UNIQUE INDEX "packaging_profiles_one_default_key"
  ON "packaging_profiles" ("is_default") WHERE "is_default";

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_amounts_check"
  CHECK ("return_shipping_cost_minor" >= 0 AND "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "store_credit_ledger" ADD CONSTRAINT "store_credit_amount_check"
  CHECK ("amount_minor" <> 0 AND "currency" ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------------------------
-- Append-only ledgers and records that are never deleted
-- ---------------------------------------------------------------------------------------------

CREATE TRIGGER "order_verification_attempts_append_only_trg"
  BEFORE UPDATE OR DELETE ON "order_verification_attempts"
  FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "order_verification_attempts_no_truncate_trg"
  BEFORE TRUNCATE ON "order_verification_attempts"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "order_cost_lines_append_only_trg"
  BEFORE UPDATE OR DELETE ON "order_cost_lines"
  FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "order_cost_lines_no_truncate_trg"
  BEFORE TRUNCATE ON "order_cost_lines"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "shipment_events_append_only_trg"
  BEFORE UPDATE OR DELETE ON "shipment_events"
  FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "shipment_events_no_truncate_trg"
  BEFORE TRUNCATE ON "shipment_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "store_credit_ledger_append_only_trg"
  BEFORE UPDATE OR DELETE ON "store_credit_ledger"
  FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "store_credit_ledger_no_truncate_trg"
  BEFORE TRUNCATE ON "store_credit_ledger"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    REVOKE UPDATE, DELETE ON TABLE "order_verification_attempts", "order_cost_lines",
      "shipment_events", "store_credit_ledger" FROM "auren_app";
    -- Refunds, parcels and returns change state but are never deleted.
    REVOKE DELETE ON TABLE "refunds", "shipments", "return_requests", "return_items"
      FROM "auren_app";
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security on every new table (see public.auren_secure_table)
-- ---------------------------------------------------------------------------------------------

SELECT public.auren_secure_table('order_verification_attempts'::regclass);
SELECT public.auren_secure_table('order_cost_lines'::regclass);
SELECT public.auren_secure_table('refunds'::regclass);
SELECT public.auren_secure_table('shipments'::regclass);
SELECT public.auren_secure_table('shipment_events'::regclass);
SELECT public.auren_secure_table('packaging_profiles'::regclass);
SELECT public.auren_secure_table('return_requests'::regclass);
SELECT public.auren_secure_table('return_items'::regclass);
SELECT public.auren_secure_table('store_credit_ledger'::regclass);
