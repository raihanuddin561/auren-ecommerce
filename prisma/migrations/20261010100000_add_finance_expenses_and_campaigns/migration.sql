-- CreateEnum
CREATE TYPE "expense_category_type" AS ENUM (
  'marketing',
  'payroll',
  'rent',
  'utilities',
  'software',
  'photography',
  'packaging_stock',
  'logistics',
  'professional_fees',
  'bank_charges',
  'misc'
);

-- CreateEnum
CREATE TYPE "marketing_campaign_channel" AS ENUM (
  'meta',
  'google',
  'tiktok',
  'influencer',
  'email',
  'offline'
);

-- CreateEnum
CREATE TYPE "recurring_expense_cadence" AS ENUM (
  'monthly',
  'weekly',
  'yearly'
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "expense_category_type" NOT NULL,
    "is_cogs" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "marketing_campaign_channel" NOT NULL,
    "utm_campaign" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "budget_minor" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "cadence" "recurring_expense_cadence" NOT NULL DEFAULT 'monthly',
    "day_of_period" INTEGER NOT NULL DEFAULT 1,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "expense_date" DATE NOT NULL,
    "category_id" UUID NOT NULL,
    "campaign_id" UUID,
    "recurring_expense_id" UUID,
    "vendor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "attachment_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_financial_summaries" (
    "date" DATE NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "gross_sales_minor" BIGINT NOT NULL DEFAULT 0,
    "discounts_minor" BIGINT NOT NULL DEFAULT 0,
    "refunds_minor" BIGINT NOT NULL DEFAULT 0,
    "net_sales_minor" BIGINT NOT NULL DEFAULT 0,
    "cogs_minor" BIGINT NOT NULL DEFAULT 0,
    "shipping_charged_minor" BIGINT NOT NULL DEFAULT 0,
    "shipping_cost_minor" BIGINT NOT NULL DEFAULT 0,
    "gateway_fees_minor" BIGINT NOT NULL DEFAULT 0,
    "cod_fees_minor" BIGINT NOT NULL DEFAULT 0,
    "packaging_minor" BIGINT NOT NULL DEFAULT 0,
    "returns_cost_minor" BIGINT NOT NULL DEFAULT 0,
    "marketing_minor" BIGINT NOT NULL DEFAULT 0,
    "opex_minor" BIGINT NOT NULL DEFAULT 0,
    "gross_profit_minor" BIGINT NOT NULL DEFAULT 0,
    "net_profit_minor" BIGINT NOT NULL DEFAULT 0,
    "recomputed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_financial_summaries_pkey" PRIMARY KEY ("date")
);

-- CreateIndexes
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date" DESC);
CREATE INDEX "expenses_category_id_expense_date_idx" ON "expenses"("category_id", "expense_date");
CREATE INDEX "expenses_campaign_id_idx" ON "expenses"("campaign_id");
CREATE INDEX "marketing_campaigns_utm_campaign_idx" ON "marketing_campaigns"("utm_campaign");
CREATE INDEX "recurring_expenses_is_active_idx" ON "recurring_expenses"("is_active");
CREATE INDEX "expense_categories_type_idx" ON "expense_categories"("type");

-- ForeignKeys
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Constraints
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_minor_positive" CHECK ("amount_minor" > 0);

ALTER TABLE "recurring_expenses"
  ADD CONSTRAINT "recurring_expenses_amount_minor_positive" CHECK ("amount_minor" > 0);

ALTER TABLE "marketing_campaigns"
  ADD CONSTRAINT "marketing_campaigns_budget_minor_nonnegative" CHECK ("budget_minor" >= 0);

-- Row level security on every new table (see public.auren_secure_table)
SELECT public.auren_secure_table('expense_categories'::regclass);
SELECT public.auren_secure_table('marketing_campaigns'::regclass);
SELECT public.auren_secure_table('recurring_expenses'::regclass);
SELECT public.auren_secure_table('expenses'::regclass);
SELECT public.auren_secure_table('daily_financial_summaries'::regclass);

-- Seed default categories
INSERT INTO "expense_categories" ("id", "name", "type", "is_cogs", "description") VALUES
  ('01927364-0001-7000-8000-000000000001', 'Digital Advertising & Performance', 'marketing', false, 'Meta Ads, Google Performance Max and influencer spend'),
  ('01927364-0002-7000-8000-000000000002', 'Fabric, Textiles & Raw Materials', 'packaging_stock', true, 'Egyptian Giza cotton, Italian wool, French linen procurement'),
  ('01927364-0003-7000-8000-000000000003', 'Atelier Studio & Showroom Rent', 'rent', false, 'Banani atelier lease and showroom facility charges'),
  ('01927364-0004-7000-8000-000000000004', 'Studio Utilities & Power', 'utilities', false, 'Studio electricity, generator diesel and internet services'),
  ('01927364-0005-7000-8000-000000000005', 'Master Tailors & Staff Payroll', 'payroll', false, 'Artisan tailoring salaries and studio staff compensation'),
  ('01927364-0006-7000-8000-000000000006', 'Cloud Infrastructure & Software', 'software', false, 'Vercel, Supabase, Inngest, Sentry and SaaS subscriptions'),
  ('01927364-0007-7000-8000-000000000007', 'Editorial Photography & Campaigns', 'photography', false, 'Seasonal lookbook photography, studio model sessions, styling'),
  ('01927364-0008-7000-8000-000000000008', 'Luxury Presentation Packaging', 'packaging_stock', true, 'Rigid gold-foil boxes, custom garment bags, tissue and ribbon'),
  ('01927364-0009-7000-8000-000000000009', 'Inbound Freight & Clearing', 'logistics', true, 'Raw material customs, port clearance and freight delivery'),
  ('01927364-0010-7000-8000-000000000010', 'Legal, Audit & Compliance', 'professional_fees', false, 'Trade license, VAT filings, legal retainers, tax counsel'),
  ('01927364-0011-7000-8000-000000000011', 'Banking, Merchant & POS Fees', 'bank_charges', false, 'Merchant acquiring fees, wire transfers, card processing rates'),
  ('01927364-0012-7000-8000-000000000012', 'Atelier Hospitality & Sundries', 'misc', false, 'Client concierge refreshments, atelier cleaning, sundry supplies')
ON CONFLICT ("id") DO NOTHING;
