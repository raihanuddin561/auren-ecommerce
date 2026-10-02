# AUREN — Progress Tracker (rolling log)

> Append newest entries at the **top**. One entry per sub-feature milestone (started, done, blocked) and per decision.
> Status table: [feature-progress.md](./feature-progress.md)

## Entry template

```
### YYYY-MM-DD — <ID> <sub-feature> — <Started | Done | Blocked>
- Type: new | enhancement | fix
- Changed: <files / modules touched>
- Tests: <unit x/x, integration x/x, e2e x/x, axe ok>
- Review: <code review result, issues fixed>
- Decisions: <ADR id or "none">
- Next: <next sub-feature ID>
- Blockers/risks: <none | details>
```

---

### 2026-10-02 — Module 1 Design System and Brand UI — run summary
- Type: 1.1 enhancement, 1.2–1.8 new
- Changed: tokens/fonts/base styles, src/components/{ui,motion,storefront,admin,style-guide}, storefront and admin shells, system pages, proxy (maintenance mode, matcher), test-only staff bypass, ADR-019 and ADR-020
- Tests: unit 368/368 · e2e 109 pass, 13 skipped by design (desktop, mobile, desktop-admin, mobile-admin) incl. axe · visual snapshots 28/28 stable · typecheck, lint, format, build green · integration not run (needs Docker)
- Review: code-reviewer 4 high, 12 medium, 11 low: all high and medium fixed (bypass hardening, access-denied boundary, 3:1 control borders, select/palette focus, proxy matcher, maintenance allow-list, selection counts, sign-out failure, copy that overpromised); premium-ui-qa: axe clean, high and medium fixed (44px targets, palette focus return, hero, taka glyph, mega menu scrim, toast close, mobile menu)
- Decisions: ADR-019 in-house DataTable, ADR-020 test-only staff bypass
- Next: Module 2
- Blockers/risks: 1.6 and 1.7 E2E Blocked on Docker (real-login spec written); visual baselines are win32 only; placeholder seed art shows colour names; social links, store address and WhatsApp number need owner input; no staff-facing guard yet distinguishes non-staff from errors beyond the layout check

### 2026-10-02 — 1.8 System pages — Done
- Type: new
- Changed: src/app/{not-found,global-error}.tsx, (storefront)/{not-found,error}.tsx, maintenance/page.tsx, proxy.ts, components/storefront/not-found-content.tsx, env MAINTENANCE_MODE
- Tests: unit 16 new (system pages, maintenance, matcher) · e2e system-pages 6 runs, axe ok
- Review: matcher no longer skips dotted paths, maintenance allow-list is explicit, error copy no longer claims an order is unchanged
- Decisions: none
- Next: module wrap-up
- Blockers/risks: no server-level run with MAINTENANCE_MODE=1

### 2026-10-02 — 1.7 Internal style guide page — Blocked (real-login E2E waiting for Docker)
- Type: new
- Changed: src/app/admin/(console)/style-guide, src/components/style-guide/*, tests/e2e/style-guide.*.spec.ts, playwright.config.ts (bypass server, visual opt-in), pnpm test:e2e:visual
- Tests: 28 visual snapshots (light and dark) · 22 interaction/axe specs on desktop and mobile
- Review: fixed mobile overflow, single h1, unique landmark names
- Decisions: ADR-020
- Next: 1.8
- Blockers/risks: waiting for Docker for admin-shell.db.spec.ts

### 2026-10-02 — 1.6 Admin shell — Blocked (real-login E2E waiting for Docker)
- Type: new
- Changed: src/components/admin/{shell,data-table,kpi-card,form-section,page-header,access-denied}, lib/{admin-nav,admin-theme,csv,test-bypass}, console layout and dashboard
- Tests: unit 22 + csv 6 + bypass 15 · bypass E2E on desktop and mobile with axe in light and dark
- Review: bypass hardened (explicit local APP_URL, local Host, loopback forwarded-for only), FORBIDDEN rendered by the layout
- Decisions: ADR-019, ADR-020
- Next: 1.7
- Blockers/risks: see 1.7

### 2026-10-02 — 1.1–1.5 Tokens, fonts, primitives, motion, storefront shell — stages Done, review gate pending
- Type: 1.1 enhancement, 1.2–1.5 new
- Changed: src/styles/globals.css, src/app/fonts.ts, src/app/layout.tsx, src/lib/{cn,brand,motion,site}.ts, src/components/{ui,motion,storefront}/*, src/app/(storefront)/*, admin field/sign-out/two-factor-setup migrated to primitives, env NEXT_PUBLIC_WHATSAPP_NUMBER
- Tests: unit 311/311 (93 new: tokens and contrast, primitives, motion, site) · e2e 25 pass + 6 skipped by design on desktop+mobile against a dev server (storefront shell, keyboard, focus trap, reduced motion, axe with menus open)
- Review: pending (code-reviewer, premium-ui-qa)
- Decisions: none
- Next: 1.6
- Blockers/risks: gold #A8875A (3.0:1) and warning #9A6B1F (4.2:1) fail AA as text on ivory, so small accent/warning text uses gold-strong and warning-strong; the spec colours stay for borders, fills and the focus ring

### 2026-10-02 — Module 0 Foundation and Platform — run summary
- Type: new
- Changed: whole foundation (see per-item entries), CHANGELOG.md, README.md, ADR-016/017/018 + OD-12, DATA-MODEL and ARCHITECTURE corrections, skills auren-nextjs-patterns / auren-db-change / auren-testing updated for installed versions
- Tests: unit 218/218 · integration 61/61 (PGlite, not Docker) · e2e 26/26 DB-free desktop+mobile, axe clean · typecheck, lint, format, build green
- Review: code-reviewer x4 and commerce-invariants-reviewer x2 run; all high and medium findings fixed
- Decisions: ADR-016 CSP without nonces, ADR-017 identity, ADR-018 outbox dispatcher, OD-12
- Next: Module 1 (after Docker verification of the blocked items)
- Blockers/risks: 4 sub-features Done, 11 Blocked on Docker/GitHub verification only; db:reset never executed

### 2026-10-02 — 0.10–0.13 review gate — Done (Docker-dependent verification still pending)
- Type: fix
- Changed: audit redaction by whole word + truncation hash; Sentry scrubbing for transactions/breadcrumbs/IP headers; CI (cancel only on PRs, Sentry upload on main only, audit informational, dependabot commit lint ignore, preview bypass); integration database name guard; catalog integration tests
- Tests: unit 218/218 · integration 61/61 on PGlite · e2e 26/26 DB-free
- Review: code-reviewer found 2 high (E2E sign-ins sharing one rate-limit bucket, missing catalog constraint tests) and 7 medium; all addressed
- Decisions: none
- Next: 0.15
- Blockers/risks: see per-item Blocked entries

### 2026-10-02 — 0.15 Seed data — Blocked (db:reset and Docker run pending)
- Type: new
- Changed: prisma/seed.ts, seed-catalog.ts, seed-data.ts, scripts/generate-seed-images.ts, public/seed/*; migration add_catalog_foundation
- Tests: unit 8/8 · integration 14 on PGlite (constraints, ledger reconciliation, idempotent reseed) · db:seed verified twice
- Review: code-reviewer: seed production guard, catalog constraint tests, extra CHECKs (movement direction, non-negative threshold and cost)
- Decisions: none
- Next: module wrap-up
- Blockers/risks: run pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed, and pnpm db:reset once, when Docker exists

### 2026-10-02 — 0.14 Security headers + rate limiting — Done
- Type: new
- Changed: src/lib/security/headers.ts, rate-limit.ts, request-meta.ts, src/app/api/auth/[...all]/route.ts, next.config.ts, ADR-016/OD-12
- Tests: unit 31 new · e2e 12 new (desktop+mobile) all green · axe ok
- Review: code-reviewer: client IP validation and trust modes, strict default bucket for unlisted auth mutations, per-account login limit, Redis timeout falls back to memory, LRU eviction, HSTS without preload
- Decisions: ADR-016 (CSP without nonces), OD-12
- Next: 0.15
- Blockers/risks: script-src keeps unsafe-inline until Next.js supports nonces with PPR; set TRUSTED_PROXY when hosting outside Vercel

### 2026-10-02 — 0.13 Observability — Blocked (DB-backed E2E waiting for Docker)
- Type: new
- Changed: src/instrumentation.ts, instrumentation-client.ts, src/lib/observability/*, src/app/global-error.tsx, src/app/api/health/route.ts, src/lib/health*.ts, src/lib/redis.ts, next.config.ts
- Tests: unit 12 new (172 total green); integration health check added
- Review: pending batch
- Decisions: @sentry/nextjs v11 exports withSentryConfig from the /config subpath and has no sendDefaultPii option
- Next: 0.14
- Blockers/risks: real Sentry delivery and source map upload need a DSN and token

### 2026-10-02 — 0.12 CI pipeline — Blocked (needs GitHub run and owner branch protection)
- Type: new
- Changed: .github/workflows/*, .github/dependabot.yml, .github/pull_request_template.md, docs/runbooks/ci-and-branch-protection.md
- Tests: workflow YAML formatted; every command in it verified locally except Docker based ones
- Review: pending
- Decisions: none
- Next: 0.13
- Blockers/risks: gh CLI not installed here, so branch protection could not be applied

### 2026-10-02 — 0.11 Testing harness — Blocked (Docker-dependent parts unverified)
- Type: new
- Changed: vitest.integration.config.ts, tests/integration/*, tests/factories, playwright.config.ts, tests/e2e/*; scripts test:integration, test:e2e
- Tests: unit 160/160 · integration 43/43 on PGlite (not Docker Postgres; no true concurrency) · e2e 14/14 DB-free (desktop+mobile, axe clean)
- Review: pending batch review
- Decisions: credential accounts must use account_id = user id (found by the integration run; fixed in owner bootstrap and factory)
- Next: 0.12
- Blockers/risks: Testcontainers startup, concurrent-connection behaviour and *.db.spec.ts need Docker

### 2026-10-02 — 0.10 Audit log — Blocked (integration waiting for Docker)
- Type: new
- Changed: src/modules/audit/*, src/lib/request-meta.ts; prisma AuditLog + migration add_audit_log
- Tests: unit 11/11; integration pending Docker
- Review: batch review pending
- Decisions: no FK from audit_logs.actor_id to users so the trail outlives accounts
- Next: 0.11
- Blockers/risks: none

### 2026-10-02 — 0.9 Outbox + background jobs — Blocked (integration proofs waiting for Docker)
- Type: new
- Changed: src/lib/outbox.ts, inbox.ts, events.ts, jobs/client.ts, jobs/functions.ts, src/app/api/inngest/route.ts; prisma OutboxEvent, ProcessedEvent + migration add_outbox
- Tests: unit 14/14; integration pending Docker
- Review: commerce-invariants-reviewer PASS; fixed 4 medium (batch poison isolation, status guards on updates, crash-loop terminal state, MATERIALIZED lease CTE) plus TRUNCATE guard and dispatched_at check
- Decisions: dispatcher leases rows, sends outside the transaction, Inngest event id = outbox id for de-duplication; handlers use runOnce
- Next: 0.10
- Blockers/risks: processed_events and dispatched outbox rows need a retention job later

### 2026-10-02 — 0.7/0.8 review gate — Done
- Type: fix
- Changed: auth.ts (linking off, staff social block, rate limits, no auto sign-in), users.role removed, owner bootstrap (lib/owner.ts, scripts/create-owner.ts), tests/lint/admin-guards.test.ts, safer next param, backup code acknowledgement
- Tests: unit 134/134 after fixes
- Review: code-reviewer found 2 high (Google skips staff TOTP, account-linking pre-hijack) and 5 medium; all addressed
- Decisions: social login is customer-only and unlinked until customer accounts work revisits it
- Next: 0.9
- Blockers/risks: none new

### 2026-10-01 — 0.8 Staff RBAC — Blocked (integration and E2E waiting for Docker)
- Type: new
- Changed: src/lib/permissions.ts, staff.ts, src/proxy.ts, src/app/admin/**, src/components/admin/*; prisma staff_members, role_permissions + migration add_staff_access (seeded grants)
- Tests: unit 21 new (permissions, staff, proxy); integration and E2E pending Docker
- Review: code-reviewer running
- Decisions: users.two_factor_enabled is the single source of truth for staff 2FA (staff_members.two_factor_enabled from DATA-MODEL dropped to avoid drift)
- Next: 0.9
- Blockers/risks: PPR means the admin layout gate redirects client-side after the shell streams; unauthenticated users get a true 307 from the proxy first

### 2026-10-01 — 0.7 Authentication core — Blocked (integration flow waiting for Docker)
- Type: new
- Changed: src/lib/auth.ts, auth-client.ts, email.ts, src/emails/auth.ts, src/app/api/auth/[...all]/route.ts; prisma users/sessions/accounts/verifications/two_factors + migration add_auth_tables
- Tests: unit 11/11; integration (sign up, verify, sign in, reset) pending Docker
- Review: pending batch review with 0.8
- Decisions: auth mail is sent directly by Better Auth callbacks, not through the outbox (no transaction, user can re-request); ADR to be added with 0.9
- Next: 0.8
- Blockers/risks: none beyond Docker

### 2026-10-01 — 0.6 Money and core utilities — Blocked (idempotency DB proof waiting for Docker)
- Type: new
- Changed: src/lib/money.ts, logger.ts, errors.ts, action-result.ts, idempotency.ts, ids.ts; prisma IdempotencyKey + migration add_idempotency_keys
- Tests: unit 94/94 (money 100% stmt/branch/func/line)
- Review: commerce-invariants-reviewer: no high. Fixed medium: idempotency keys namespaced per actor, TTL by DB clock (7 days), strict thousands-separator parsing, currency whitelist via Intl, int64 range check in money(), rate validation, MoneyError maps to VALIDATION
- Decisions: none
- Next: 0.7
- Blockers/risks: replay and concurrency tests for runIdempotent need Postgres

### 2026-10-01 — 0.2 Code quality tooling — Done
- Type: new
- Changed: eslint.config.mjs, eslint.boundaries.mjs, .prettierrc.json, .lintstagedrc.json, commitlint.config.mjs, .husky/*, tests/lint/*
- Tests: unit 17/17 fixture tests for layering (allowed and forbidden imports)
- Review: code-reviewer: boundaries test no longer writes into src/, internal module files and generated client classified
- Decisions: lib/db may be imported by services, queries and repositories (skill text updated)
- Next: 0.3
- Blockers/risks: eslint-plugin-boundaries 7.2 prints a deprecation warning for mode full (partialMatch false does not classify files)

### 2026-10-01 — 0.3 Environment config — Done
- Type: new
- Changed: src/lib/env/schema.ts, src/lib/env.ts, src/lib/env.client.ts, .env.example, next.config.ts
- Tests: unit 14/14; build fails with readable message when required vars missing (manual proof)
- Review: SKIP_ENV_VALIDATION honoured in env.ts; placeholder secret only rejected for non-local APP_URL in production
- Decisions: none
- Next: 0.4
- Blockers/risks: none

### 2026-10-01 — 0.4 Local infrastructure — Blocked (waiting for Docker)
- Type: new
- Changed: docker-compose.yml, scripts/db-reset.ts, prisma/seed.ts (stub), db:* scripts
- Tests: compose and scripts not executable without Docker
- Review: code-reviewer HIGH fixed: db-reset now checks DATABASE_URL and DIRECT_URL for local hosts; ports bound to 127.0.0.1; mailpit pinned to v1.31
- Decisions: none
- Next: 0.5
- Blockers/risks: verify with pnpm db:up once Docker Desktop is installed

### 2026-10-01 — 0.5 Database + Prisma baseline — Blocked (waiting for Docker)
- Type: new
- Changed: prisma/schema.prisma, prisma.config.ts, prisma/migrations/20261001230000_init_baseline, src/lib/db.ts, src/lib/ids.ts
- Tests: unit 3 (ids); integration pending Docker. Migration SQL applied cleanly on in-process PGlite as a syntax sanity check only
- Review: code-reviewer: placeholder URL for prisma generate, DB_POOL_MAX, generated-client boundary added
- Decisions: Prisma generates UUIDv7 ids (uuid(7)); no ADR needed
- Next: 0.6 (no DB needed)
- Blockers/risks: run pnpm db:up && pnpm db:migrate:deploy once Docker exists

### 2026-10-01 — 0.1 Project scaffold — Done
- Type: new
- Changed: package.json, pnpm-workspace.yaml (allowBuilds), tsconfig.json, next.config.ts, src/app, src/styles/globals.css, AGENTS.md (generated by Next)
- Tests: typecheck, lint, build green
- Review: code-reviewer pass on 0.1-0.5; findings fixed
- Decisions: none. better-auth pinned to 1.7.6 because pnpm 12 minimumReleaseAge rejects releases younger than 1 day (1.7.7)
- Next: 0.2
- Blockers/risks: Prisma warns Node 26 is not in its supported list (20.19+, 22.12+, 24+); works so far

### 2026-10-01 — Implementation readiness: skills, agents, tooling — Done
- Type: enhancement
- Changed: removed auto-cancel everywhere (owner decision; INV-O2); added skills `auren-brand`, `auren-nextjs-patterns`, `auren-module-scaffold`, `auren-db-change`, `auren-commerce-invariants`, `auren-testing`, `auren-definition-of-done`; rewrote `module-feature-completer` for this stack (fixed `context/` paths, removed Java/surefire steps, replaced Anthropic `brand-guidelines` with `auren-brand`); added agents `commerce-invariants-reviewer`, `premium-ui-qa`; fixed `find-bugs` base branch (`main`); fenced off `brand-guidelines`; fixed YAML in `architect-review.md`; added `.claude/settings.json` allowlist; installed pnpm 12.8.1
- Tests: all 76 skill/agent frontmatters YAML-validated
- Decisions: OD-11 updated (no auto-cancel)
- Next: 0.1 Project scaffold
- Blockers/risks: no Docker/PostgreSQL locally (affects 0.4, 0.11); payment and courier merchant accounts still to apply for

### 2026-10-01 — Requirement change: mandatory staff order verification — Done (planning)
- Type: enhancement (requirement from business owner)
- Changed: ARCHITECTURE §3.2 events, §5 orders, §6 state machine, new §6.1, §11 roles · DATA-MODEL orders fields, `order_verification_attempts`, `customer_risk_flags`, roles · DESIGN §4.7 copy, §4.11 verification queue screen · DECISIONS ADR-015, OD-11 · feature-list 0.8, 4.7, 6.1–6.5, **new 6.13–6.15**, 13.2, 13.3, 13.7, 15.1, **new 15.7**
- Decisions: ADR-015 (supersedes auto-confirm of prepaid orders); bulk confirm removed from order list
- Next: unchanged; confirm OD-1 … OD-11, then start 0.1
- Blockers/risks: verification needs staff coverage during business hours; SLA defaults pending OD-11

### 2026-10-01 — Architecture baseline — Done
- Type: new
- Changed: `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA-MODEL.md`, `docs/architecture/DECISIONS.md`, `docs/design/DESIGN-SYSTEM.md`, `context/feature-list.md`, `context/feature-progress.md`, `CLAUDE.md`
- Tests: n/a (planning)
- Decisions: ADR-001 … ADR-014 accepted; OD-1 … OD-10 open with defaults
- Next: confirm open decisions OD-1 … OD-10, then start **Module 0, sub-feature 0.1 (Project scaffold)**
- Blockers/risks: Payment gateway (SSLCommerz) and courier (Pathao/Steadfast) merchant accounts need business registration lead time. **Start applications now.**
