# AUREN

Premium menswear e-commerce platform. Next.js (App Router, Cache Components), TypeScript strict, PostgreSQL + Prisma, Tailwind v4, Better Auth, Inngest.

Planning and conventions live in `CLAUDE.md`, `docs/architecture/` and `context/`. Read those before changing anything.

## Quick start

Requirements: Node 24+ (26 works), pnpm 12 and a local PostgreSQL 16+ (your own installation; Docker is optional).

```bash
pnpm install
cp .env.example .env.local   # git-ignored; add your database passwords and SEED_OWNER_* (see below)
# one time, as the postgres user: psql -h localhost -U postgres -f scripts/local-db-setup.local.sql
#   (copy scripts/local-db-setup.sql first and set two passwords; details: docs/runbooks/local-database.md)
pnpm setup:local             # = pnpm db:migrate:deploy && pnpm db:seed
pnpm dev
```

`.env.local` needs `DATABASE_URL` (role `auren_app`), `DIRECT_URL` (role `auren_migrator`), `BETTER_AUTH_SECRET` (32+ characters) and, for the integration tests, `TEST_DATABASE_URL` and `TEST_APP_DATABASE_URL` (database `auren_test`). Prisma commands, the seed and `pnpm dev` all read it.

| URL                                  | What                                           |
| ------------------------------------ | ---------------------------------------------- |
| http://localhost:3000                | Storefront (home, shop)                        |
| http://localhost:3000/admin/sign-in  | Staff sign-in                                  |
| http://localhost:3000/admin          | Console (after sign-in and two-factor)         |
| http://localhost:3000/admin/security | Authenticator setup (first sign-in lands here) |
| http://localhost:3000/api/health     | Health check                                   |

### Demo login and first-run two-factor

1. Set `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` in `.env.local`. For a throwaway local password also set `SEED_DEMO_ADMIN=1` (local only: it skips the forced password change; the app refuses to boot with it outside a localhost, non-production run, and production rejects it and `SEED_OWNER_PASSWORD`). Run `pnpm db:seed`.
2. Open `/admin/sign-in` and sign in with that email and password.
3. You land on `/admin/security` (staff two-factor is mandatory). Confirm your password, scan the QR code with an authenticator app (or choose manual entry and type the key shown), enter the 6-digit code, save the backup codes and continue to `/admin`.
4. Next sign-ins ask for the 6-digit code after the password.

Without `SEED_DEMO_ADMIN` the owner must also choose a new password at first sign-in. For a production database create the owner with `pnpm owner:create you@example.com` and never set `SEED_OWNER_PASSWORD` there.

### Tests

```bash
pnpm test                    # unit
pnpm test:integration        # real PostgreSQL in TEST_DATABASE_URL (auren_test), never the dev database
E2E_WITH_DB=1 pnpm test:e2e  # build + Playwright incl. database specs (point DATABASE_URL at auren_test)
```

Email goes to Mailpit locally (`SMTP_URL`), to Resend in production (`RESEND_API_KEY`), and to the log when neither is set. Background jobs: run `pnpm dlx inngest-cli@latest dev` and keep `INNGEST_DEV=1`.

## Commands

| Command                                                           | What it does                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`                          | Next.js                                                                                                             |
| `pnpm typecheck` / `pnpm lint` / `pnpm format`                    | Quality gates (also run by Husky and CI)                                                                            |
| `pnpm test` / `pnpm test:coverage`                                | Unit tests (money utilities require 100 % coverage)                                                                 |
| `pnpm test:integration`                                           | Real PostgreSQL: `TEST_DATABASE_URL` (name must contain `test`), else Testcontainers (needs Docker)                 |
| `pnpm test:e2e`                                                   | Build, then Playwright (desktop + mobile, axe). `E2E_WITH_DB=1` adds the database specs                             |
| `pnpm test:e2e:visual`                                            | Style guide visual snapshots (per platform baselines; add `-- --update-snapshots` after a deliberate design change) |
| `pnpm db:up` / `db:down` / `db:reset`                             | Local infrastructure; `db:reset` wipes the local database, migrates and seeds                                       |
| `pnpm db:migrate` / `db:migrate:deploy` / `db:seed` / `db:studio` | Prisma                                                                                                              |

## Notes

- Money is integer minor units through `src/lib/money.ts`. No floats.
- Every order is verified by staff before it can be confirmed, and the system never cancels an order on its own.
- Environment variables are validated in `src/lib/env/schema.ts`; `next dev` and `next build` fail with a readable list when `DATABASE_URL` or `BETTER_AUTH_SECRET` is missing.
- How cost and selling price work, and how to fix variants that cannot be ordered for lack of cost: `docs/runbooks/how-cost-works.md`.
- CI and branch protection: `docs/runbooks/ci-and-branch-protection.md`.

## Troubleshooting (Windows)

- **`npm.ps1 cannot be loaded because running scripts is disabled`** (PowerShell): run
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once and reopen the terminal,
  or use `npm.cmd run dev`, Command Prompt or Git Bash instead.
- **`Another next dev server is already running`**: a previous dev server still holds port 3000. Stop it with
  `taskkill /PID <pid> /F` (the PID is printed in the message), then start again.
- **Database connection errors**: make sure the PostgreSQL Windows service is running (`net start postgresql-x64-18`
  from an administrator terminal), then see `docs/runbooks/local-database.md`.

## Checks and commits

Commits are deliberately fast: the pre-commit hook only runs the secret scan and Prettier on the staged files.
The slower checks run on demand and in CI:

- `pnpm check`: typecheck, lint (cached), format check and unit tests. Run it before opening a pull request.
- `pnpm lint`: ESLint with a cache (`.eslintcache`); the first run takes a minute or two, later runs are quick.
- `pnpm test:integration` and `pnpm test:e2e`: need the local database (see the Quick start).
