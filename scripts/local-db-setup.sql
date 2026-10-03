-- One-time local PostgreSQL setup for AUREN development (no Docker needed).
--
-- Run it ONCE as the local superuser, after replacing the two CHANGE-ME placeholders below with
-- passwords of your own (they only protect your own machine, but do not reuse a real password):
--
--   psql -h localhost -U postgres -f scripts/local-db-setup.sql
--
-- It creates
--   auren_migrator  owns the schema; runs migrations and seeds (DIRECT_URL)
--   auren_app       the least-privilege runtime role the app uses (DATABASE_URL)
--   auren           the development database
--   auren_test      the integration-test database (its name must contain "test")
-- and is safe to run again (nothing is dropped; existing roles keep their passwords).
-- Then follow docs/runbooks/local-database.md.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_migrator') THEN
    CREATE ROLE auren_migrator LOGIN PASSWORD 'CHANGE-ME-migrator' NOSUPERUSER NOCREATEDB CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    CREATE ROLE auren_app LOGIN PASSWORD 'CHANGE-ME-app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Lets the migrator switch to the app role, which the integration tests use to prove what the
-- app role cannot do (SET ROLE auren_app).
GRANT auren_app TO auren_migrator;

-- The same defaults the migration would set, for runners that may not set role defaults.
ALTER ROLE auren_app SET search_path = public, pg_catalog;
ALTER ROLE auren_app SET statement_timeout = '60s';
ALTER ROLE auren_app SET idle_in_transaction_session_timeout = '60s';

SELECT 'CREATE DATABASE auren OWNER auren_migrator'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auren')
\gexec

SELECT 'CREATE DATABASE auren_test OWNER auren_migrator'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auren_test')
\gexec

-- Extensions the migrations need, created here because they need superuser rights locally.
\connect auren
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
\connect auren_test
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
