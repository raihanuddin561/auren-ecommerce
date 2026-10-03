# AUREN — Premium menswear e-commerce

Next.js (App Router, latest) · TypeScript strict · PostgreSQL + Prisma · Tailwind v4 + shadcn/ui · Better Auth · Inngest.

## Read before working
- Architecture: `docs/architecture/ARCHITECTURE.md`
- Data model: `docs/architecture/DATA-MODEL.md`
- Decisions (ADR + open questions): `docs/architecture/DECISIONS.md`
- Design system and page specs: `docs/design/DESIGN-SYSTEM.md`
- What to build: `context/feature-list.md` · Status: `context/feature-progress.md` · Log: `context/progress-tracker.md`

## Tracking rules
- Work one sub-feature at a time, by ID from `context/feature-list.md`.
- When a stage finishes, update its row in `context/feature-progress.md` and add an entry at the top of `context/progress-tracker.md`.
- Skip rows whose Notes contain `HOLD`.
- Architectural changes need a new ADR in `DECISIONS.md` in the same PR.

## Non-negotiable conventions
- Layering: `app/` → `modules/<x>/{actions,queries}` → `service` → `repository` → Prisma. Never import Prisma outside a repository. Never call another module's repository; use its service or a domain event.
- Every Server Action / Route Handler: Zod-validate input, then authenticate/authorize (`assertPermission`) on the server.
- Money is `BIGINT` minor units + currency, handled only through `lib/money.ts`. No floats.
- **Every order must be verified by staff with `orders.verify` before it can be `confirmed`.** No auto-confirm path, no bulk confirm (ARCHITECTURE §6.1, ADR-015).
- Order lines snapshot price **and** cost. Stock changes go only through `inventoryService` and write `stock_movements`.
- Side effects (email, SMS, CAPI, courier, finance rollup) go through the outbox → Inngest. Handlers must be idempotent.
- Server Components by default; `"use client"` only for interactive leaves.
- Public pages: `generateMetadata`, canonical, JSON-LD, and loading/empty/error states.
- Admin mutations: permission check + `audit()`.
- UI uses design tokens and existing primitives from `src/components/ui`; sharp radii, 4:5 product images, `prefers-reduced-motion` respected.
- Module numbers never appear in routes, component names, UI copy or test names.
- Conventional Commits; branch `feat/<area>-<desc>`.

## Project skills and agents (use them)
- Skills: `auren-brand` (all UI; **never** use `brand-guidelines`, which is Anthropic's brand) · `auren-nextjs-patterns` (all code) · `auren-module-scaffold` · `auren-db-change` · `auren-commerce-invariants` · `auren-testing` · `auren-definition-of-done`
- Agents: `module-feature-completer` (runs a module end-to-end) · `commerce-invariants-reviewer` (gate for commerce/finance) · `premium-ui-qa` (visual gate for storefront UI) · plus the generic specialists in `.claude/agents/`
- Start a module with: "start implementation Module N: <title>"

## Local environment (as of 2026-10-01)
- Node 26, pnpm 12, git installed. **Development uses the owner's own local PostgreSQL** (Windows service on localhost:5432), not Docker: one-time setup is `scripts/local-db-setup.sql`, see `docs/runbooks/local-database.md`. Integration tests run against `TEST_DATABASE_URL` (database name must contain "test"). Docker is optional (`docker compose` for Postgres + Mailpit, Testcontainers when `TEST_DATABASE_URL` is unset); CI uses a Postgres service container.
- **Production**: Vercel + **Supabase Postgres** (ADR-025: transaction pooler for the app, direct connection for migrations, Data API off, RLS on every table) + **Vercel Blob** for media (ADR-026; local filesystem in development). Never use the Supabase `service_role` key in the app.
- `create-next-app` refuses non-empty folders: scaffold into a temp folder and move the files in, keeping `docs/`, `context/`, `.claude/`, `.agents/` and `CLAUDE.md`.

## Commands (filled in during sub-feature 0.1)
- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed`
