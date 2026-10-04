-- Human-facing purchase order numbers (PO-0001).
CREATE SEQUENCE "purchase_order_number_seq" START 1;

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('active', 'committed', 'released');

-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "landed_cost_type" AS ENUM ('freight', 'customs_duty', 'inbound_transport', 'agent_fee', 'other');

-- CreateEnum
CREATE TYPE "allocation_method" AS ENUM ('by_quantity', 'by_value');

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "po_number" TEXT NOT NULL DEFAULT ('PO-'::text || lpad((nextval('purchase_order_number_seq'::regclass))::text, 4, '0'::text)),
    "supplier_id" UUID NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'draft',
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "ordered_at" TIMESTAMPTZ(6),
    "expected_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost_minor" BIGINT NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_costs" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "type" "landed_cost_type" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "allocation_method" "allocation_method" NOT NULL DEFAULT 'by_quantity',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "po_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_minor" BIGINT NOT NULL,
    "landed_cost_minor" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_reservations_variant_id_idx" ON "stock_reservations"("variant_id");

-- CreateIndex
CREATE INDEX "stock_reservations_location_id_idx" ON "stock_reservations"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_reference_type_reference_id_variant_id_key" ON "stock_reservations"("reference_type", "reference_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_created_at_idx" ON "purchase_orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "purchase_order_items_variant_id_idx" ON "purchase_order_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_po_id_variant_id_key" ON "purchase_order_items"("po_id", "variant_id");

-- CreateIndex
CREATE INDEX "landed_costs_po_id_idx" ON "landed_costs"("po_id");

-- CreateIndex
CREATE INDEX "goods_receipts_po_id_idx" ON "goods_receipts"("po_id");

-- CreateIndex
CREATE INDEX "goods_receipts_location_id_idx" ON "goods_receipts"("location_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_receipt_id_idx" ON "goods_receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_po_item_id_idx" ON "goods_receipt_items"("po_item_id");

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reservations hold a positive quantity for a reference, and an open one always has an expiry.
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_check"
  CHECK ("quantity" > 0 AND length(btrim("reference_type")) > 0 AND length(btrim("reference_id")) > 0
         AND (("status" = 'active') = ("resolved_at" IS NULL)));
CREATE INDEX "stock_reservations_active_expiry_idx" ON "stock_reservations" ("expires_at") WHERE "status" = 'active';

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_name_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_status_check"
  CHECK ("status" IN ('draft', 'cancelled') OR "ordered_at" IS NOT NULL);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_check"
  CHECK ("quantity_ordered" > 0 AND "quantity_received" >= 0 AND "quantity_received" <= "quantity_ordered"
         AND "unit_cost_minor" >= 0);
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_amount_check" CHECK ("amount_minor" >= 0);
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_check"
  CHECK ("quantity" > 0 AND "unit_cost_minor" >= 0 AND "landed_cost_minor" >= 0);

-- Receipts are a ledger: a delivery that happened is corrected with another movement, never edited.
CREATE TRIGGER "goods_receipts_append_only_trg"
  BEFORE UPDATE OR DELETE ON "goods_receipts" FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "goods_receipts_no_truncate_trg"
  BEFORE TRUNCATE ON "goods_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "goods_receipt_items_append_only_trg"
  BEFORE UPDATE OR DELETE ON "goods_receipt_items" FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "goods_receipt_items_no_truncate_trg"
  BEFORE TRUNCATE ON "goods_receipt_items" FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    REVOKE UPDATE, DELETE ON TABLE "goods_receipts", "goods_receipt_items" FROM "auren_app";
  END IF;
END
$$;

-- Releases every reservation that has expired and writes the matching ledger rows. SKIP LOCKED
-- lets two workers run side by side; running it twice releases nothing the second time.
CREATE FUNCTION "release_expired_reservations"(p_limit integer DEFAULT 500)
RETURNS TABLE ("released_variant_id" uuid, "released_quantity" integer)
LANGUAGE plpgsql AS $fn$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT s."id", s."variant_id", s."location_id", s."quantity", s."reference_type", s."reference_id"
    FROM "stock_reservations" s
    WHERE s."status" = 'active' AND s."expires_at" <= now()
    ORDER BY s."expires_at"
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

-- The one warehouse the shop starts with.
INSERT INTO "locations" ("id", "name", "type", "is_default", "is_active", "updated_at")
SELECT gen_random_uuid(), 'Main warehouse', 'warehouse', true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM "locations" WHERE "is_default");

-- Row level security on every new table (see public.auren_secure_table).
SELECT public.auren_secure_table('stock_reservations'::regclass);
SELECT public.auren_secure_table('suppliers'::regclass);
SELECT public.auren_secure_table('purchase_orders'::regclass);
SELECT public.auren_secure_table('purchase_order_items'::regclass);
SELECT public.auren_secure_table('landed_costs'::regclass);
SELECT public.auren_secure_table('goods_receipts'::regclass);
SELECT public.auren_secure_table('goods_receipt_items'::regclass);
