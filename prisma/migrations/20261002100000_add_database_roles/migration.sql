-- Database least privilege.
--
--   auren_migrator  the intended schema owner; runs migrations (DIRECT_URL). Never used by the app.
--                   A fresh database is still owned by whoever ran the first migration (the compose
--                   superuser locally); docs/runbooks/database-roles.md hands ownership over.
--   auren_app       the runtime role (DATABASE_URL): DML only. It does not own any object, cannot
--                   run DDL, TRUNCATE, create objects or disable triggers, and cannot rewrite ledgers.
--
-- Both roles are created NOLOGIN here so no secret lives in a migration. `pnpm db:roles` (or the
-- runbook) gives them a login and a password out of band.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_migrator') THEN
    CREATE ROLE "auren_migrator" NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    CREATE ROLE "auren_app" NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
  END IF;
END
$$;

-- Nobody but the schema owner creates objects in public; the migrator may.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO "auren_migrator";
GRANT USAGE ON SCHEMA public TO "auren_app";

-- A compromised session must not be able to shadow real tables with temporary ones, and the
-- role resolves names in a fixed order with bounded statements and idle transactions.
DO $$
BEGIN
  EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'could not revoke TEMPORARY from PUBLIC (not the database owner); do it as the owner';
END
$$;
-- (A migration runner without CREATEROLE rights cannot set these: the runbook SQL sets them then.)
DO $$
BEGIN
  ALTER ROLE "auren_app" SET search_path = public, pg_catalog;
  ALTER ROLE "auren_app" SET statement_timeout = '60s';
  ALTER ROLE "auren_app" SET idle_in_transaction_session_timeout = '60s';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'could not set role defaults for auren_app; run docs/runbooks/database-roles.md step "role defaults" as an administrator';
END
$$;

-- Baseline: data manipulation on every existing table, nothing else (no TRUNCATE, TRIGGER, REFERENCES).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "auren_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "auren_app";

-- Tables created later by the role that runs migrations get the same baseline automatically. When
-- the runner is not auren_migrator itself, its own future tables are covered too (if it may).
-- A migration that adds a ledger must REVOKE UPDATE, DELETE on it (a test enforces this).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "auren_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "auren_app";
DO $$
BEGIN
  IF current_user <> 'auren_migrator' AND pg_has_role(current_user, 'auren_migrator', 'USAGE') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE "auren_migrator" IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "auren_app";
    ALTER DEFAULT PRIVILEGES FOR ROLE "auren_migrator" IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO "auren_app";
  END IF;
END
$$;

-- Migration bookkeeping is the migrator's alone.
REVOKE ALL ON TABLE "_prisma_migrations" FROM "auren_app";

-- Append-only ledgers: the application may add rows and read them, never change or remove them.
-- (Triggers already refuse the writes; this takes the privilege away so a trigger that is dropped
-- or disabled is not the only line of defence.)
REVOKE UPDATE, DELETE ON TABLE "audit_logs", "stock_movements" FROM "auren_app";

-- The consumer inbox is insert-only for the same reason: rewriting it would replay side effects.
-- Retention deletes run through a migrator-owned function added with the retention job.
REVOKE UPDATE, DELETE ON TABLE "processed_events" FROM "auren_app";

-- The outbox row is immutable apart from delivery bookkeeping, so only those columns are updatable
-- and rows are never deleted by the application (retention runs through a dedicated function).
REVOKE UPDATE, DELETE ON TABLE "outbox_events" FROM "auren_app";
GRANT UPDATE ("status", "attempts", "available_at", "locked_until", "last_error", "dispatched_at")
  ON TABLE "outbox_events" TO "auren_app";

-- A dispatched event is finished: it cannot be moved back to pending (which would replay every
-- order, email and courier booking in history) and its dispatch time cannot be rewritten.
CREATE OR REPLACE FUNCTION "outbox_events_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'outbox_events rows cannot be deleted';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."aggregate_type" IS DISTINCT FROM OLD."aggregate_type"
     OR NEW."aggregate_id" IS DISTINCT FROM OLD."aggregate_id"
     OR NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'outbox_events content is immutable';
  END IF;
  IF OLD."status" = 'dispatched'
     AND (NEW."status" IS DISTINCT FROM OLD."status"
          OR NEW."dispatched_at" IS DISTINCT FROM OLD."dispatched_at") THEN
    RAISE EXCEPTION 'a dispatched outbox event cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Role to permission mapping is system data: changing it is a privilege change made by a migration
-- (or by a future, explicitly granted admin feature), never by an arbitrary SQL statement from the app.
REVOKE INSERT, UPDATE, DELETE ON TABLE "role_permissions" FROM "auren_app";

-- Fail the deployment instead of silently applying less than the above. This happens when the
-- migration is run by a role that does not own the schema or its tables (see the runbook).
DO $$
BEGIN
  IF has_schema_privilege('public', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'least privilege: PUBLIC can still create objects in schema public (run this migration as the schema owner)';
  END IF;
  IF has_table_privilege('auren_app', 'public.audit_logs', 'UPDATE')
     OR has_table_privilege('auren_app', 'public.audit_logs', 'DELETE')
     OR has_table_privilege('auren_app', 'public.stock_movements', 'UPDATE')
     OR has_table_privilege('auren_app', 'public.stock_movements', 'DELETE')
     OR has_table_privilege('auren_app', 'public.outbox_events', 'DELETE')
     OR has_table_privilege('auren_app', 'public.outbox_events', 'TRUNCATE')
     OR has_table_privilege('auren_app', 'public.processed_events', 'UPDATE')
     OR has_table_privilege('auren_app', 'public.role_permissions', 'UPDATE') THEN
    RAISE EXCEPTION 'least privilege: auren_app can still modify a protected table (run this migration as the table owner)';
  END IF;
END
$$;
