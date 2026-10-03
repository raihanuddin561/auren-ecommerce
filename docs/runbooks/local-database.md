# Local database (your own PostgreSQL, no Docker)

Development and the integration tests use the PostgreSQL service installed on this machine
(`localhost:5432`). Docker is optional (ADR-025); CI uses a Postgres service container.

## One-time setup

1. Open `scripts/local-db-setup.sql` and replace the two placeholders `CHANGE-ME-migrator` and
   `CHANGE-ME-app` with two passwords of your own (they only protect this machine). Do not commit the edited file:
   copy it first (`cp scripts/local-db-setup.sql scripts/local-db-setup.local.sql`; `*.local.sql` is git-ignored) and edit the copy.
2. Run it ONCE as the local `postgres` user (it asks for that password):

   ```bash
   psql -h localhost -U postgres -f scripts/local-db-setup.local.sql
   ```

   If `psql` is not on the PATH, use the full path, for example
   `"C:\Program Files\PostgreSQL\17\bin\psql.exe"` (adjust the version number).

   It creates the roles `auren_migrator` (owns the schema, runs migrations) and `auren_app` (the
   least-privilege runtime role), the databases `auren` and `auren_test`, and the `citext` and
   `pg_trgm` extensions. It is safe to run again; an existing role keeps its old password. To change one:
   `ALTER ROLE auren_app PASSWORD '...';` as `postgres`.
3. Put the same passwords in `.env.local` (never committed):

   ```
   DATABASE_URL=postgresql://auren_app:<app password>@localhost:5432/auren
   DIRECT_URL=postgresql://auren_migrator:<migrator password>@localhost:5432/auren
   TEST_DATABASE_URL=postgresql://auren_migrator:<migrator password>@localhost:5432/auren_test
   TEST_APP_DATABASE_URL=postgresql://auren_app:<app password>@localhost:5432/auren_test
   ```

   Delete any `CLOUDINARY_*` lines from `.env.local`: Cloudinary is no longer used (ADR-026). Leave `BLOB_READ_WRITE_TOKEN` empty in development.
4. Create the schema and data:

   ```bash
   pnpm db:migrate:deploy      # runs as DIRECT_URL (auren_migrator)
   pnpm db:seed                # owner account, categories, products
   ```

## What reads `.env.local`

`pnpm dev`, `next build`, `pnpm db:migrate:deploy`, `pnpm db:seed`, `pnpm db:reset`, `pnpm db:roles` and `pnpm owner:create` read `.env.local` first, then `.env`. The integration tests read only the `TEST_*` variables from it (never `DATABASE_URL`), so a test run cannot touch the development database.

## Time zone

The migration `session_timezone_utc` sets the time zone of the database and of both login roles to UTC (ADR-027); the Prisma driver sends UTC text and a server in another zone (Asia/Dhaka) would otherwise store every timestamp hours off. If a migration prints a notice that it could not set it, run as `postgres`: `ALTER DATABASE auren SET timezone = 'UTC'; ALTER DATABASE auren_test SET timezone = 'UTC'; ALTER ROLE auren_app SET timezone = 'UTC'; ALTER ROLE auren_migrator SET timezone = 'UTC';`

## Integration tests

```bash
pnpm test:integration
```

With `TEST_DATABASE_URL` set the suite migrates and wipes that database (its name must contain
`test`, and the host must be local) and never touches `auren`. With `TEST_APP_DATABASE_URL` set as
well, the checks that log in as `auren_app` run for real (they are skipped otherwise). Without
`TEST_DATABASE_URL`, Testcontainers starts a PostgreSQL and needs Docker. The local setup gives `auren_migrator` the `CREATEROLE` attribute (it is the only role the tests log in with, and one test creates a probe role); the container and production roles do not have it.

## Troubleshooting

- `password authentication failed` (28P01): the role exists with another password, or does not
  exist yet. Run the setup (step 2) or `ALTER ROLE ... PASSWORD`, and fix `.env.local`.
- `permission denied to create extension`: run the setup script as `postgres`; it creates the extensions.
- Optional Docker alternative: `pnpm db:up` starts PostgreSQL and Mailpit; `.env.example` shows the URLs.
