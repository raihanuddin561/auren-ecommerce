-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('owner', 'admin', 'manager', 'order_verifier', 'fulfillment', 'finance', 'content_editor', 'support');

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "staff_role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "staff_role" NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_user_id_key" ON "staff_members"("user_id");

-- CreateIndex
CREATE INDEX "staff_members_role_idx" ON "staff_members"("role");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Default grants. The owner can edit these later; new permissions need a new migration.
INSERT INTO "role_permissions" ("role", "permission") VALUES
    ('owner', 'orders.read'),
    ('owner', 'orders.update'),
    ('owner', 'orders.verify'),
    ('owner', 'orders.cancel'),
    ('owner', 'orders.refund'),
    ('owner', 'orders.fulfill'),
    ('owner', 'catalog.read'),
    ('owner', 'catalog.write'),
    ('owner', 'catalog.publish'),
    ('owner', 'inventory.read'),
    ('owner', 'inventory.adjust'),
    ('owner', 'purchasing.manage'),
    ('owner', 'shipping.manage'),
    ('owner', 'returns.manage'),
    ('owner', 'customers.read'),
    ('owner', 'customers.write'),
    ('owner', 'promotions.manage'),
    ('owner', 'reviews.moderate'),
    ('owner', 'content.manage'),
    ('owner', 'finance.read'),
    ('owner', 'finance.write'),
    ('owner', 'analytics.read'),
    ('owner', 'settings.manage'),
    ('owner', 'audit.read'),
    ('owner', 'staff.manage'),
    ('admin', 'orders.read'),
    ('admin', 'orders.update'),
    ('admin', 'orders.verify'),
    ('admin', 'orders.cancel'),
    ('admin', 'orders.refund'),
    ('admin', 'orders.fulfill'),
    ('admin', 'catalog.read'),
    ('admin', 'catalog.write'),
    ('admin', 'catalog.publish'),
    ('admin', 'inventory.read'),
    ('admin', 'inventory.adjust'),
    ('admin', 'purchasing.manage'),
    ('admin', 'shipping.manage'),
    ('admin', 'returns.manage'),
    ('admin', 'customers.read'),
    ('admin', 'customers.write'),
    ('admin', 'promotions.manage'),
    ('admin', 'reviews.moderate'),
    ('admin', 'content.manage'),
    ('admin', 'finance.read'),
    ('admin', 'finance.write'),
    ('admin', 'analytics.read'),
    ('admin', 'settings.manage'),
    ('admin', 'audit.read'),
    ('manager', 'orders.read'),
    ('manager', 'orders.update'),
    ('manager', 'orders.verify'),
    ('manager', 'orders.cancel'),
    ('manager', 'orders.refund'),
    ('manager', 'orders.fulfill'),
    ('manager', 'catalog.read'),
    ('manager', 'catalog.write'),
    ('manager', 'catalog.publish'),
    ('manager', 'inventory.read'),
    ('manager', 'inventory.adjust'),
    ('manager', 'purchasing.manage'),
    ('manager', 'shipping.manage'),
    ('manager', 'returns.manage'),
    ('manager', 'customers.read'),
    ('manager', 'customers.write'),
    ('manager', 'promotions.manage'),
    ('manager', 'reviews.moderate'),
    ('manager', 'analytics.read'),
    ('order_verifier', 'orders.read'),
    ('order_verifier', 'orders.update'),
    ('order_verifier', 'orders.verify'),
    ('order_verifier', 'orders.cancel'),
    ('order_verifier', 'customers.read'),
    ('fulfillment', 'orders.read'),
    ('fulfillment', 'orders.fulfill'),
    ('fulfillment', 'shipping.manage'),
    ('fulfillment', 'inventory.read'),
    ('finance', 'orders.read'),
    ('finance', 'finance.read'),
    ('finance', 'finance.write'),
    ('finance', 'analytics.read'),
    ('finance', 'purchasing.manage'),
    ('content_editor', 'catalog.read'),
    ('content_editor', 'content.manage'),
    ('content_editor', 'reviews.moderate'),
    ('support', 'orders.read'),
    ('support', 'orders.update'),
    ('support', 'orders.verify'),
    ('support', 'orders.cancel'),
    ('support', 'returns.manage'),
    ('support', 'customers.read'),
    ('support', 'customers.write')
ON CONFLICT DO NOTHING;
