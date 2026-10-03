-- AlterTable
-- Set on accounts created with a generated or configured bootstrap password (the first owner).
-- Staff with this flag are held at /admin/security until they choose their own password.
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
