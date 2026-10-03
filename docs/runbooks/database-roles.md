# Database roles (least privilege)

AUREN uses two PostgreSQL roles (ADR-021). Migration `add_database_roles` creates both as `NOLOGIN`; this runbook gives them a login and, in a real environment, makes `auren_migrator` the owner. Nothing in the repository contains their passwords. Roles are cluster-wide: every database on one server shares the same two roles and passwords.

| Role | Used by | Connection variable | Can do |
|---|---|---|---|
| `auren_migrator` | `prisma migrate`, break-glass maintenance | `DIRECT_URL` | Owns every object, runs DDL |
| `auren_app` | the running application, seeds, `pnpm owner:create` | `DATABASE_URL` | `SELECT/INSERT/UPDATE/DELETE` on ordinary tables only |

What `auren_app` cannot do (proved by `tests/integration/database-roles.int.test.ts`):

- create, alter or drop any object, `TRUNCATE`, create or disable triggers, or `SET session_replication_role`;
- `UPDATE` or `DELETE` rows of `audit_logs`, `stock_movements`, `processed_events`, nor any other table that carries the append-only trigger;
- change anything in `outbox_events` except the delivery columns (`status`, `attempts`, `available_at`, `locked_until`, `last_error`, `dispatched_at`), move a dispatched event back to pending, or delete outbox rows;
- write `role_permissions` or read `_prisma_migrations`;
- create temporary tables that shadow real ones (`TEMPORARY` is revoked from PUBLIC), or leave a transaction idle for more than 60 s.

Retention of `outbox_events` and `processed_events` is not implemented yet; those tables grow until the retention job (security operations work) adds a migrator-owned purge function.

## Bootstrap a new database (staging, production)

Use an admin connection (the provider's owner role, which has `CREATEROLE`). Call it `<admin>`.

1. Apply migrations as `<admin>`: `DIRECT_URL=postgresql://<admin>:...@<host>/<db> pnpm db:migrate:deploy`. This creates the roles and the grants. The migration fails the deployment (it does not silently apply less) if the executing role does not own the schema and tables.
2. Hand ownership to the migrator, still as `<admin>`:

   ```sql
   GRANT auren_migrator TO <admin>;                       -- needed to transfer ownership to it
   DO $$
   DECLARE r record;
   BEGIN
     FOR r IN SELECT format('%I.%I', schemaname, tablename) AS n FROM pg_tables WHERE schemaname = 'public' LOOP
       EXECUTE 'ALTER TABLE ' || r.n || ' OWNER TO auren_migrator';
     END LOOP;
     FOR r IN SELECT format('%I.%I', schemaname, sequencename) AS n FROM pg_sequences WHERE schemaname = 'public' LOOP
       EXECUTE 'ALTER SEQUENCE ' || r.n || ' OWNER TO auren_migrator';
     END LOOP;
     FOR r IN SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS f
                FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.prokind = 'f' LOOP
       EXECUTE 'ALTER FUNCTION ' || r.f || ' OWNER TO auren_migrator';
     END LOOP;
     FOR r IN SELECT format('%I.%I', n.nspname, t.typname) AS ty
                FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
       EXECUTE 'ALTER TYPE ' || r.ty || ' OWNER TO auren_migrator';
     END LOOP;
   END $$;
   ALTER SCHEMA public OWNER TO auren_migrator;
   ALTER DEFAULT PRIVILEGES FOR ROLE auren_migrator IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auren_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE auren_migrator IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO auren_app;
   ```

   Do not use `REASSIGN OWNED BY` on a managed host: it also tries to move the database and provider-owned objects. Rolling back is the same loop with the previous owner's name.
3. Give both roles a login with two long random passwords (`openssl rand -base64 32`), connecting as `<admin>` (the migrator cannot alter roles):

   ```
   ROLES_ADMIN_URL=postgresql://<admin>:...@<host>/<db> \
   DATABASE_URL=postgresql://auren_app:<app-pw>@<host>/<db> \
   AUREN_MIGRATOR_PASSWORD=<migrator-pw> \
   pnpm db:roles
   ```

   The password is sent in an `ALTER ROLE` statement. If the server logs every statement, set the passwords from the provider console instead.
4. Set the environment (Vercel project settings, not the repository):
   - `DATABASE_URL`: `auren_app` (Supabase transaction pooler, port 6543, `?sslmode=require`)
   - `DIRECT_URL`: `auren_migrator` (direct or session connection, port 5432, `?sslmode=require`; never the transaction pooler), used by the migrate step of CI/CD.
5. Verify (as `<admin>`):

   ```sql
   SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname LIKE 'auren_%';
   SELECT tableowner, count(*) FROM pg_tables WHERE schemaname = 'public' GROUP BY 1;   -- only auren_migrator
   ```

   Connect as `auren_app` and confirm `UPDATE audit_logs SET action = action` and `CREATE TABLE x(i int)` are both refused.

## Supabase (production, ADR-025)

Supabase's `postgres` user is not a superuser but has `CREATEROLE`, which is all the steps above need: use it as `<admin>` and do not use any superuser-only feature (no `ALTER SYSTEM`, no `CREATE EXTENSION` of untrusted extensions, no `session_replication_role`).

1. Dashboard, Project Settings, Database: copy the **direct connection** host (or the **session pooler**, both port 5432) for `<admin>` and `DIRECT_URL`, and the **transaction pooler** (port 6543) host for `DATABASE_URL`. Pooler user names carry the project reference: `auren_app.<project-ref>`, `auren_migrator.<project-ref>`. Append `?sslmode=require` to both. Boot in production refuses equal URLs, a missing `sslmode`, a local host and a transaction pooler used for `DIRECT_URL`.
2. Extensions, once, as `postgres`: `CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;` (Supabase would otherwise put them in `extensions`, which `auren_app` does not have on its search path).
3. Run the bootstrap above: migrations (as `postgres` through the direct connection), ownership transfer, `pnpm db:roles`.
4. **Turn the Data API off**: Dashboard, Project Settings, Data API (API Settings), disable it (or at least remove `public` from "Exposed schemas"). AUREN talks to the database only through the server; the PostgREST endpoints are an unused attack surface. Also leave Supabase Auth, Storage and Realtime unused. Never put the `anon`, `authenticated` or `service_role` keys into any environment variable of this application: the `service_role` key bypasses Row Level Security.
5. Defence in depth, applied by the migration `secure_public_schema`: Row Level Security is enabled on every public table with one policy, for `auren_app` only; `anon`, `authenticated` and `service_role` hold no privileges and no default privileges on future tables. Re-run it any time as the schema owner: `SELECT public.auren_lock_data_api();` (for example after a Supabase upgrade). `tests/integration/public-schema-security.int.test.ts` fails when a table lacks RLS or an API role holds a privilege.
6. Network: in Database settings enable SSL enforcement, and restrict direct connections (Network Restrictions) to the CI egress addresses if your plan has it; the pooler is what Vercel uses.
7. The Prisma `pg` adapter does not use named prepared statements, so the transaction pooler works; keep `DB_POOL_MAX` at 10 or less per instance.

## Adding a ledger table later

Tables created by `auren_migrator` (or by the role that ran the role migration) automatically receive `SELECT, INSERT, UPDATE, DELETE` for `auren_app`. A migration that adds an append-only table must also run:

```sql
REVOKE UPDATE, DELETE ON TABLE "<ledger>" FROM "auren_app";
```

and attach the `forbid_ledger_mutation()` triggers. The integration test fails for any table with those triggers that still lets `auren_app` update or delete (table or column level), and for any table the application cannot read or write that is not on the explicit exception list in that test.

## Local development

On your own PostgreSQL, `scripts/local-db-setup.sql` creates both roles with logins, the `auren` and `auren_test` databases and the extensions in one run: see `docs/runbooks/local-database.md`. With the optional Docker setup, `docker compose` creates the `auren` superuser, which owns the schema; run `pnpm db:roles` once after `pnpm db:migrate`.

## CI

The unit and integration jobs create throwaway databases. The integration harness connects as the container superuser to reset tables and gives `auren_app` a login to run the real-login checks. The browser tests still use the superuser for `DATABASE_URL`.
