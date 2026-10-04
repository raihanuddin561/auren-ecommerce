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

### 2026-10-04 — 2.9 to 2.14 and 3.1 to 3.7 Inventory, purchasing, storefront listing and product page — Done
- Type: new (all rows)
- Changed: prisma migrations add_inventory_and_purchasing and harden_reservation_release; src/modules/inventory and src/modules/purchasing (repository, service, schemas, actions, queries, cost maths, PO state machine, PDF); catalog (pdp.ts, card.ts, listing.ts, storefront queries, sitemap queries, cost helpers); src/modules/cart (addToCart contract, not persisted); admin pages inventory, movements, suppliers, purchasing (list, new, detail, edit, PDF route); storefront routes shop, collections, search stub, products/[slug] (page, live island, OG image), sitemap.ts, robots.ts; components storefront/{catalog,pdp}, admin/{inventory,purchasing}; prisma seed (supplier and four purchase orders through the real services); ADR-029; DATA-MODEL; admin nav; navigation links to existing routes only.
- Tests: unit 1034/1034 · integration 242 passed, 1 skipped by design on the real local PostgreSQL (incl. 50 parallel buys, mixed reserve/receive/expiry, ledger reconcile, avg cost worked examples, receipts, roles) · Playwright 245 passed on the full run, with axe at desktop and mobile; two first-pass flakes (catalog-categories create form clicked before hydration; shop back-navigation count) passed on rerun and with retries · typecheck, lint, format:check, secret-scan --all clean · build ok
- Review: commerce-invariants-reviewer 3 high (missing EXECUTE grant on the expiry function, commit of an expired hold silently succeeding, landed cost added after a partial receipt), 6 medium, 7 low; code-reviewer 13 medium, 18 low; premium-ui-qa FAIL on first run (PDP overflow at 375, chat button over the sticky bar, dead Collections menu links, wrong title face, gallery not a stacked column). All high and medium findings fixed: new migration, commitReservation names its lines, landed costs only before the first delivery, step-up for any removal, NO KEY UPDATE variant lock, cost base over all locations and a currency check, audit allowlist, cost visibility limited to purchasing and finance staff, buy box availability from the resolved variant, try/catch around every action call, focus return, gallery column, menu links, safe-area bar. premium-ui-qa re-run: all fixes verified (no overflow at 375, 768 or 1440, axe clean, CLS about 0); a last buy-box row overflow at 375 was fixed and re-checked: verdict pass, with two low axe notes left (accordion heading order, chat button outside a landmark) and a cosmetic 48 px heart beside a 56 px button.
- Decisions: ADR-029 (ledger semantics, landed cost allocation, weighted average cost, expiry and commit rules)
- Next: cart and checkout (4.x) replace the addToCart integration point in src/modules/cart/service.ts
- Blockers/risks: add to bag does not persist (honest toast); soft 404 (unknown product answers 200 with noindex because the page streams behind loading.tsx); sitemap is prerendered and revalidated hourly; the receive-time currency is BDT only; all product pictures are SVG placeholders so crop and hover images were not judged; PDP spec items for later modules (ratings, fit meter, delivery estimate, Complete the look); header links /new, /lookbook, /journal and the cart prefetch still point at pages that do not exist yet; the catalog-categories Playwright spec flakes on the first create click under load; PLP header is tall on desktop and 768 defaults to four columns (design polish)

### 2026-10-04 — 3.1, 3.2, 3.3 Stock ledger, adjustments, atomic reserve/commit/release (backend milestone) — Done
- Type: new
- Changed: prisma schema and migration add_inventory_and_purchasing (stock_reservations, suppliers, purchase orders and items, landed costs, goods receipts, PO sequence, release_expired_reservations(), default warehouse, RLS, receipts append-only); src/modules/inventory (repository, service, schemas, actions, queries, tags, Inngest job releaseExpiredStock); catalog service cost helpers (lockVariantCosts, setVariantAverageCost, productIdsForVariants)
- Tests: inventory integration 16/16 on the real local test DB (incl. 50 parallel buys); inventory actions unit 5/5
- Review: pending (runs after 3.7)
- Decisions: ledger semantics (on_hand vs reserved) documented in service.ts; ADR to follow with purchasing
- Next: 3.4 suppliers, 3.5 purchase orders, 3.6 landed costs, 3.7 goods receipt
- Blockers/risks: none

### 2026-10-04 — Part 1 runnable base, 2.1 to 2.5 and 2.7 catalogue admin, Blocked rows verified on real PostgreSQL — Done
- Type: new (2.1 to 2.5, 2.7), enhancement and fix (runnable base)
- Changed: src/modules/catalog (schemas, service, repository, actions, queries, redirect snapshot, matrix, slug, rules), migrations session_timezone_utc, add_collections_size_charts_redirects, catalog_constraints; admin screens for products, categories, collections, size charts; shared SortableList, SingleImageField, shrink-image; home page catalogue sections; proxy slug redirects; demo admin switch (SEED_DEMO_ADMIN) with production guards; env loading from .env.local for Prisma, seed and integration tests; auth client origin fix; stub loader fix for Playwright; README Quick start; ADR-027 and ADR-028.
- Tests: unit 891/891 · integration 207 passed, 1 skipped by design (CI-only guard) on the real local PostgreSQL (auren_test, auren_app real login block ran) · Playwright 170 passed with axe on desktop and mobile (16 skipped: visual and preview-only) incl. demo admin TOTP enrolment, catalogue specs, 301 redirect through the proxy · typecheck, lint, format:check, secret-scan --all clean
- Review: code-reviewer (2 high, 14 medium) and commerce-invariants-reviewer (1 high, 6 medium) findings fixed and re-reviewed (1 high regex typo and 4 medium fixed): product row locks, option/value ids, redirect hardening and cache, publish rights in the service, upload authorisation order, constraint mapping, advisory locks, NOT-rule NULLs, SKU probing, UI fixes. Real-Postgres run found: time zone shift of timestamps, probe-role grants, stale specs, auth client pointing at the build-time URL, SKU suffix collision, mobile overflow in FormSection.
- Decisions: ADR-027 (UTC session time zone), ADR-028 (redirects in the proxy, collections rebuilt on write, publish rights)
- Next: Module 2 storefront rows 2.9 to 2.14 (PLP, card, PDP, island, SEO); 3.1 inventory (variants currently start without stock rows)
- Blockers/risks: 0.4 stays Blocked (docker compose db:up unverified) and 0.12 (GitHub runs); a customer opening a console URL gets the 404 page with HTTP 200 (streamed shell); redirect snapshot per instance is up to 15 s stale; variants start with avg cost 0 until purchasing sets it (orders must refuse a variant without a cost basis); uploads over about 4.5 MB on Vercel rely on the browser shrinking the file; no step-up on catalogue deletes; premium-ui-qa visual gate not run on the new home sections; 2.6 and 2.8 (P1) skipped as instructed

### 2026-10-03 — 18.7 to 18.11 Telemetry, secret scan, abuse specs, security operations, insider risk — Done
- Type: enhancement (18.9 new, specs only)
- Changed: audit of the work already in a6a2e9d per row (see feature-progress Notes for the evidence). Added: JWT rule in src/lib/observability/scrub.ts, console gate extracted to src/components/admin/shell/staff-gate.tsx, /.well-known/ open during maintenance (src/proxy.ts), runbook step for GitHub secret scanning and push protection (ci-and-branch-protection.md), key-rotation runbook refreshed (no Cloudinary, adds Blob, Turnstile, health token), new tests: telemetry (JWT, E.164), staff-gate 404, sourcemaps-config, abuse-control-specs, security-operations, proxy well-known
- Tests: unit 746/746 (was 714) · integration 162 passed, 3 skipped (real-login block) on PGlite with TZ=UTC and DB_POOL_MAX=1, no integration code changed · typecheck, lint, format:check, secret-scan --all and --history clean
- Review: code-reviewer 1 high (a progress-file edit script corrupted context/feature-progress.md; restored from git and re-applied) and 4 medium (tests coupled to the element tree, source-text regexes on next.config.ts, weak keyword needles, section lookup) fixed
- Decisions: none (ADR-015, INV-O1 and INV-O2 untouched; ADR-021..026 cover the controls)
- Next: Module 18 remaining rows (18.2 stays Blocked until the owner's local PostgreSQL logins work), then Module 4
- Blockers/risks: Playwright checks need a working local database (not run here); GitHub secret scanning and push protection are owner settings, not verifiable from code; owner alert email delivery not exercised against a real provider

### 2026-10-03 — 18.12 Hosting and media infrastructure (Supabase, Vercel Blob, local database) — Done
- Type: enhancement
- Changed: step 0 verified the interrupted tree (typecheck, lint, unit 644/644 green; format fixed). Docs: ARCHITECTURE, DECISIONS (ADR-025 Supabase supersedes the Neon choice and updates OD-5; ADR-026 Vercel Blob/local supersedes ADR-012), DATA-MODEL, CLAUDE.md, README, .env.example, auren-testing and auren-db-change skills (new tables must call auren_secure_table / ENABLE ROW LEVEL SECURITY), runbooks (database-roles Supabase section, local-database, production-environment). Code: src/lib/media/* (MediaProvider local + Vercel Blob, random keys, HMAC signed private links, magic-byte validation with no SVG, sharp re-encode stripping EXIF/GPS, Blob host check), media route handlers, CSP img-src for *.public.blob.vercel-storage.com, migration media_storage_columns (product_media provider, storage_key, content_type, size_bytes with CHECKs), global-setup TEST_APP_DATABASE_URL, secret-scan skips .local-media, ignores for git/prettier/eslint, Cloudinary removed from env. package.json: @vercel/blob, sharp. feature-list rows 2.3, 14.8, 18.1, 18.9 updated and 18.12 added
- Tests: unit 714/714 (media upload, traversal and signed links, Blob provider and host check; CSP; config) · integration 162 passed, 3 skipped (real-login block) on an in-process PGlite server with TZ=UTC (the local PostgreSQL rejected the .env.local logins), including public-schema-security (RLS on every table, API roles empty) and media-storage constraints · typecheck, lint, format:check, secret scan clean
- Review: code-reviewer 3 medium and 7 low; fixed: future-function default privileges (global REVOKE per creator role, test), DB CHECKs on storage_key and URL per provider, scope private and public pdf keys refused, NaN size cap, anchored test-host guard. Accepted: PUBLIC USAGE on schema public kept (Supabase internals), CSP uses the store wildcard, receipts are stored as received
- Decisions: ADR-025, ADR-026
- Next: 18.7 (and the owner's one-time local database setup, which clears the Blocked state of 18.2)
- Blockers/risks: local PostgreSQL logins fail (28P01), so 18.2 stays Blocked; PGlite reports local time as UTC unless TZ=UTC, which broke one alert test until the server ran with TZ=UTC; public/seed SVG placeholders still ship in public/ (documented, replaced when catalog media goes live)

### 2026-10-03 — 18.3 Session hardening — Done
- Type: enhancement
- Changed: src/lib/{auth,staff,session-policy,step-up,step-up-token,owner,errors,action-result}.ts, src/modules/identity/*, src/components/admin/{password-change-form,sign-out-everywhere-button,field}.tsx, src/app/admin/(auth)/security, src/app/admin/(console)/account, prisma migration add_forced_password_change, env BETTER_AUTH_SECRETS, docs/runbooks/key-rotation.md
- Tests: unit and integration cover revocation on reset and change, no sliding, staff cap, bootstrap flag, step-up (password, real TOTP, purpose, expiry, other session, delays, audit), sign out everywhere · e2e account page with axe
- Review: code-reviewer 6 medium and security-auditor 4 medium fixed (step-up uses the rotated secret and a purpose, audit before grant, trusted-device shortcut disabled, unchanged password refused server side, reset clears the bootstrap flag, self-service lint allowlist, a11y of the form); the hooks.before body mutation did not take effect until it returned the new context (found by the integration tests)
- Decisions: none (ADR-021 covers roles)
- Next: 18.4
- Blockers/risks: Better Auth 1.7.6 cannot hash session tokens; TOTP codes can be replayed within one 30 s step

### 2026-10-03 — 18.4 Fail-closed auth rate limits — Done
- Type: enhancement
- Changed: src/lib/{rate-limit,attempts,trusted-proxy,request-meta,request-body,turnstile}.ts, src/app/api/auth/[...all]/route.ts, src/components/admin/{sign-in-form,turnstile-widget}.tsx, env schema (TRUSTED_PROXY hops, Turnstile keys)
- Tests: unit (attempts, fail-closed limiters, route behaviour, hops and IPv4-mapped addresses, Turnstile) · integration (no enumeration for sign-in, reset and sign-up, per-account delay for known and unknown emails, real TOTP lockout, trusted-device refusal) · e2e per-account limit
- Review: security-auditor 1 high (requests that could not be tied to an account skipped the delay: now JSON with an email is required and the body is byte-capped), 6 medium (atomic reservation instead of check then record, IPv4-mapped bucket collapse, Turnstile hostname, unknown-address and lockout trade-offs documented) fixed
- Decisions: none
- Next: 18.5
- Blockers/risks: an attacker can delay a victim account (max 15 min, password reset still works); origin must only be reachable through the proxy when using hops:N

### 2026-10-03 — 18.5 CI/CD supply-chain hardening — Done
- Type: enhancement
- Changed: .github/workflows/{ci,e2e-preview,codeql,dependency-review,dependency-audit}.yml, .github/{CODEOWNERS,dependabot.yml}, docker-compose.yml, pnpm-workspace.yaml, tests/integration/global-setup.ts, tests/unit/ci-config.test.ts, docs/runbooks/ci-and-branch-protection.md
- Tests: 6 configuration tests (SHA pins, persist-credentials, no PR code next to secrets, identical image digests, release age and Dependabot, required workflows)
- Review: security-auditor 2 high and medium findings fixed (preview workflow trust: vercel[bot] creator, Environment-scoped secret, host allowlist; scheduled blocking audit; CodeQL concurrency; CODEOWNERS gaps; Dependabot cooldown)
- Decisions: none
- Next: 18.6
- Blockers/risks: workflows cannot run locally; action SHAs resolved from the GitHub API today and must be re-verified by the owner; minimumReleaseAge 4320 was rejected by pnpm because the lockfile holds packages younger than 3 days (2880 used)

### 2026-10-03 — 18.6 Nonce CSP for dynamic sections — Done
- Type: enhancement
- Changed: src/lib/security/headers.ts, src/proxy.ts, next.config.ts, src/app/admin/layout.tsx, docs/architecture/DECISIONS.md (ADR-022, OD-12 closed), tests (unit, lint, e2e), playwright.config.ts (readiness probe on a console page)
- Tests: unit (sections, header rules against Next path-to-regexp, nonce freshness, cache headers, maintenance) · lint (sections must be per-request) · e2e console hydrates under the nonce policy, injected inline handlers are blocked, storefront keeps the static policy, API locked down
- Review: security-auditor 4 medium fixed (matcher skipped file-like paths in sections, maintenance rewrite without CSP, no explicit no-store for nonce responses, weak lint test); low: decoded and case-insensitive section matching, script-src-attr none, autoplay=(self)
- Decisions: ADR-022 (supersedes ADR-016 for dynamic sections, closes OD-12)
- Next: 18.7
- Blockers/risks: first request to a console page loads the whole server bundle (about 40 s on this machine), so the browser-test readiness probe now waits on a console page; a corrupted .next cache made Turbopack panic until it was deleted

### 2026-10-02 — 18.2 Database least privilege — Blocked (real-login proof waiting for Docker (WSL))
- Type: new
- Changed: prisma/migrations/20261002100000_add_database_roles, scripts/db-roles.ts, scripts/db-reset.ts, tests/integration/{database-roles.int.test.ts,global-setup.ts}, docs/runbooks/database-roles.md, docs/architecture/DECISIONS.md (ADR-021), .env.example (DATABASE_URL = auren_app, DIRECT_URL = owner), .claude/skills/auren-db-change (ledger REVOKE rule), package.json (db:roles)
- Tests: integration 87 passed, 3 skipped by design (real-login block, runs when the harness owns a server) on PGlite with DB_POOL_MAX=1 · unit 412/412 · typecheck, lint, format green
- Review: security-auditor + code-reviewer: 2 high (migrator never became owner in the documented flow: runbook rewritten with explicit ownership handover and ROLES_ADMIN_URL; tests never ran dispatcher/runOnce/runIdempotent as auren_app: added), 6 medium fixed (outbox replay via status: dispatched is now terminal; migration verifies its own effect and fails the deploy; default privileges FOR ROLE auren_migrator; column-level privilege assertions and exact six-column grant; processed_events insert-only; loose regexes, SET ROLE guard in beforeAll, CI must provide real-login proof), lows fixed (TEMP revoke, search_path, timeouts, script error handling without echoing URLs)
- Decisions: ADR-021
- Next: 18.3
- Blockers/risks: waiting for Docker (WSL) for the real-login proof and a multi-connection run; password travels in ALTER ROLE (runbook warns about statement logging); inventory_levels and staff_members remain app-writable (covered by inventory constraints and 18.11 alerts)

### 2026-10-02 — 18.1 Production boot guards — Done
- Type: enhancement
- Changed: src/lib/env/{production,schema}.ts, src/lib/env.ts, next.config.ts (phase function), src/instrumentation.ts, src/lib/jobs/client.ts, src/app/api/inngest/route.ts, playwright.config.ts (LOCAL_PRODUCTION), .env.example, docs/runbooks/database-roles.md (started)
- Tests: unit 412/412 (39 new: one per refusal, local-run opt-in, build phase, SKIP flag, Inngest client mode and keys) · integration 61/61 (PGlite, DB_POOL_MAX=1) · e2e 110 pass, 14 skipped by design (production build served with LOCAL_PRODUCTION=1) · typecheck, lint, format green
- Review: code-reviewer 1 high (localhost APP_URL switched all guards off: now needs explicit LOCAL_PRODUCTION=1, never on Vercel), 5 medium (boot-time validation on serverless via register(), NEXT_PUBLIC_APP_URL must equal APP_URL, wider local-host SMTP check, hops:N message, redundant VERCEL_ENV check) all fixed; security-auditor: H1 H2 M1 closed, M2 closed once 18.4 adds hop-count mode; unsigned Inngest PUT sync disabled, serveOrigin pinned, INNGEST_BASE_URL refused
- Decisions: none (behaviour change documented in .env.example and ARCHITECTURE section 11 at 18.9)
- Next: 18.2
- Blockers/risks: Inngest cloud signature verification confirmed from the installed library source (mode cloud + signing key, fails closed), not exercised against Inngest Cloud

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
