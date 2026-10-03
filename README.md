# AUREN

Premium menswear e-commerce platform. Next.js (App Router, Cache Components), TypeScript strict, PostgreSQL + Prisma, Tailwind v4, Better Auth, Inngest.

Planning and conventions live in `CLAUDE.md`, `docs/architecture/` and `context/`. Read those before changing anything.

## First run

Requirements: Node 24+ (26 works), pnpm 12, a local PostgreSQL 16+ (your own installation; one-time setup in `docs/runbooks/local-database.md`). Docker Desktop is optional (`pnpm db:up` for Postgres + Mailpit, and Testcontainers for integration tests).

```bash
pnpm install
cp .env.example .env        # development defaults; nothing here is a real secret
# one time: psql -h localhost -U postgres -f scripts/local-db-setup.sql   (see docs/runbooks/local-database.md)
# optional: pnpm db:up      # Docker: PostgreSQL 16 + Mailpit (http://localhost:8025)
pnpm db:migrate:deploy      # apply migrations
pnpm db:seed                # owner account, 6 categories, 40 products, stock
pnpm dev                    # http://localhost:3000
```

The seed prints a temporary owner password once (or uses `SEED_OWNER_PASSWORD`). Sign in at `/admin/sign-in`; staff must enrol two-factor authentication at first login. For a production database, create the owner with `pnpm owner:create you@example.com`.

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
- CI and branch protection: `docs/runbooks/ci-and-branch-protection.md`.
