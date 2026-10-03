-- The Prisma pg adapter sends JavaScript dates as UTC wall-clock text without an offset, and
-- PostgreSQL reads that text in the SESSION time zone. On a server whose default time zone is not
-- UTC (a developer machine in Asia/Dhaka, for example) every written timestamptz was shifted by
-- the zone offset: audit rows, sessions and ledgers landed hours in the past. Pin the database
-- and both login roles to UTC so the result is the same on every host. Each step is allowed to
-- fail on its own (a provider may reserve database settings); the runbook lists the SQL to run
-- as an administrator in that case.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'UTC');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'could not set the database time zone; run: ALTER DATABASE <name> SET timezone = ''UTC'';';
END
$$;

DO $$
BEGIN
  ALTER ROLE "auren_migrator" SET timezone = 'UTC';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'could not set the UTC time zone on auren_migrator; run ALTER ROLE auren_migrator SET timezone = ''UTC''; as an administrator';
END
$$;

DO $$
BEGIN
  ALTER ROLE "auren_app" SET timezone = 'UTC';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'could not set the UTC time zone on auren_app; run ALTER ROLE auren_app SET timezone = ''UTC''; as an administrator';
END
$$;
