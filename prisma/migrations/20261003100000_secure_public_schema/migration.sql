-- Lock the public schema against the Supabase Data API (PostgREST) and any other path that is not
-- the application role.
--
-- Supabase exposes tables of the public schema through an HTTP API using the roles `anon` and
-- `authenticated` (and `service_role`, which bypasses Row Level Security). AUREN never uses that
-- API: all access goes through the server with the `auren_app` role. This migration makes the
-- database refuse the API even if it is left switched on:
--   1. Row Level Security is enabled on every table of the public schema. The only policy is the
--      one for `auren_app`; nobody else has a policy, so anon, authenticated and any future role
--      see no rows. (The table owner, `auren_migrator`, bypasses RLS by design.)
--   2. All privileges on tables, sequences and our own functions are revoked from anon,
--      authenticated and service_role, together with USAGE on the schema, and default privileges
--      are set so tables created later are covered as well.
-- On a plain PostgreSQL (development, CI) those roles do not exist and step 2 is skipped.
--
-- Every later migration that creates a table MUST end with
--   SELECT public.auren_secure_table('<table>'::regclass);
-- (an integration test fails otherwise). `public.auren_lock_data_api()` can be run again at any
-- time, for example after a Supabase upgrade, by the schema owner.

CREATE FUNCTION public.auren_secure_table(tbl regclass) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  table_name text;
BEGIN
  SELECT relname INTO table_name FROM pg_class WHERE oid = tbl;
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = table_name AND policyname = 'auren_app_full'
  ) THEN
    EXECUTE format(
      'CREATE POLICY auren_app_full ON %s AS PERMISSIVE FOR ALL TO auren_app USING (true) WITH CHECK (true)',
      tbl);
  END IF;
END
$$;

CREATE FUNCTION public.auren_lock_data_api() RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  api_role text;
  creator text;
  fn record;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', api_role);
    -- Objects created later by the roles that create objects here must not be granted to the API.
    FOREACH creator IN ARRAY ARRAY[current_user::text, 'postgres', 'supabase_admin', 'auren_migrator'] LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator);
      BEGIN
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', creator, api_role);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', creator, api_role);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', creator, api_role);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'could not change default privileges of % (not a member); an administrator should run auren_lock_data_api()', creator;
      END;
    END LOOP;
  END LOOP;

  -- Our own functions are callable by PUBLIC by default, and the API roles inherit PUBLIC: take
  -- that away (extension functions such as citext are left alone). The application role keeps the
  -- explicit grants it has (for example purge_finished_events).
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
  END LOOP;
  -- The built-in default (PUBLIC may execute every new function) is global: a schema-scoped
  -- REVOKE cannot cancel it, so it is revoked per creating role, without IN SCHEMA. A later
  -- function the application calls directly needs an explicit GRANT EXECUTE ... TO auren_app.
  FOREACH creator IN ARRAY ARRAY[current_user::text, 'postgres', 'supabase_admin', 'auren_migrator'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator);
    BEGIN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON FUNCTIONS FROM PUBLIC', creator);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not change default function privileges of % (not a member)', creator;
    END;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.auren_secure_table(regclass) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auren_lock_data_api() FROM PUBLIC;

-- Apply to everything that exists now.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    PERFORM public.auren_secure_table(t.name);
  END LOOP;
END
$$;

SELECT public.auren_lock_data_api();

-- The one explicit function grant the application role relies on survives the REVOKE above, but
-- state it again so the intent is on record.
GRANT EXECUTE ON FUNCTION public.purge_finished_events(integer) TO "auren_app";
