-- Insider-risk controls: maker-checker approvals and a database-level trail for permission edits.

-- ---------------------------------------------------------------------------------------------
-- Approvals (maker-checker). A request above a threshold needs a second, different staff member.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'pending',
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "reason" TEXT,
    "decision_note" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_fkey"
  FOREIGN KEY ("decided_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_amount_check" CHECK ("amount_minor" >= 0);
-- A decision has a decider and a time; a pending request has neither.
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decision_check" CHECK (
  ("status" = 'pending' AND "decided_by" IS NULL AND "decided_at" IS NULL)
  OR ("status" <> 'pending' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL));
-- The maker can never be the checker, whatever the application does.
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_maker_checker_check"
  CHECK ("decided_by" IS NULL OR "decided_by" <> "requested_by");
-- Only an approved request can be consumed.
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_consumed_check"
  CHECK ("consumed_at" IS NULL OR "status" = 'approved');

-- At most one open request per subject.
CREATE UNIQUE INDEX "approval_requests_one_pending_idx"
  ON "approval_requests" ("kind", "subject_type", "subject_id") WHERE "status" = 'pending';
CREATE INDEX "approval_requests_status_requested_at_idx" ON "approval_requests" ("status", "requested_at");

-- A decision is final; consuming an approval is the only later change, and only once.
CREATE FUNCTION "approval_requests_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."kind" IS DISTINCT FROM OLD."kind"
     OR NEW."subject_type" IS DISTINCT FROM OLD."subject_type"
     OR NEW."subject_id" IS DISTINCT FROM OLD."subject_id"
     OR NEW."amount_minor" IS DISTINCT FROM OLD."amount_minor"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."requested_by" IS DISTINCT FROM OLD."requested_by"
     OR NEW."requested_at" IS DISTINCT FROM OLD."requested_at" THEN
    RAISE EXCEPTION 'approval request content is immutable';
  END IF;
  IF OLD."status" <> 'pending' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."decided_by" IS DISTINCT FROM OLD."decided_by"
       OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
       OR NEW."decision_note" IS DISTINCT FROM OLD."decision_note" THEN
      RAISE EXCEPTION 'a decided approval cannot be changed';
    END IF;
    IF OLD."consumed_at" IS NOT NULL AND NEW."consumed_at" IS DISTINCT FROM OLD."consumed_at" THEN
      RAISE EXCEPTION 'an approval can be used only once';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "approval_requests_guard_trg"
  BEFORE UPDATE ON "approval_requests"
  FOR EACH ROW EXECUTE FUNCTION "approval_requests_guard"();
CREATE TRIGGER "approval_requests_no_delete_trg"
  BEFORE DELETE ON "approval_requests"
  FOR EACH ROW EXECUTE FUNCTION "forbid_ledger_mutation"();
CREATE TRIGGER "approval_requests_no_truncate_trg"
  BEFORE TRUNCATE ON "approval_requests"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();

REVOKE DELETE ON TABLE "approval_requests" FROM "auren_app";

-- ---------------------------------------------------------------------------------------------
-- The new permission, granted to the roles that may decide.
-- ---------------------------------------------------------------------------------------------
INSERT INTO "role_permissions" ("role", "permission") VALUES
    ('owner', 'approvals.decide'),
    ('admin', 'approvals.decide'),
    ('manager', 'approvals.decide')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- Every change to role_permissions leaves an audit row, whoever makes it (a migration, the
-- owner, a database administrator): the application cannot edit this table, so a change that is
-- not part of a reviewed migration is itself the signal.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION "audit_role_permission_change"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "audit_logs" ("id", "actor_id", "action", "entity_type", "entity_id", "before", "after", "created_at")
  VALUES (
    gen_random_uuid(),
    CASE WHEN current_setting('auren.actor_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN current_setting('auren.actor_id', true)::uuid END,
    'role_permission.' || lower(TG_OP),
    'role_permission',
    COALESCE(NEW."role"::text, OLD."role"::text) || ':' || COALESCE(NEW."permission", OLD."permission"),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('role', OLD."role", 'permission', OLD."permission") END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('role', NEW."role", 'permission', NEW."permission") END,
    now());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "role_permissions_audit_trg"
  AFTER INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH ROW EXECUTE FUNCTION "audit_role_permission_change"();

-- ---------------------------------------------------------------------------------------------
-- A role or active-flag change on a staff member leaves an audit row too, even when it is made
-- with raw SQL: the application role can write this table, so the database itself reports it.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION "audit_staff_member_change"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."role" IS NOT DISTINCT FROM OLD."role"
     AND NEW."active" IS NOT DISTINCT FROM OLD."active"
     AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
    RETURN NEW;
  END IF;
  INSERT INTO "audit_logs" ("id", "actor_id", "action", "entity_type", "entity_id", "before", "after", "created_at")
  VALUES (
    gen_random_uuid(),
    CASE WHEN current_setting('auren.actor_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN current_setting('auren.actor_id', true)::uuid END,
    'staff_member.' || lower(TG_OP),
    'staff_member',
    COALESCE(NEW."id", OLD."id")::text,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('role', OLD."role", 'active', OLD."active") END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('role', NEW."role", 'active', NEW."active") END,
    now());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "staff_members_audit_trg"
  AFTER INSERT OR UPDATE OR DELETE ON "staff_members"
  FOR EACH ROW EXECUTE FUNCTION "audit_staff_member_change"();
