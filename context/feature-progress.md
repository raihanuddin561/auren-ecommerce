# AUREN — Feature Progress

> One row per sub-feature from [feature-list.md](./feature-list.md). Update the row **immediately** when a stage completes.
> **Stage values:** `Todo` · `WIP` · `Done` · `N/A` · `Blocked`. **Overall** is `Done` only when every applicable stage is `Done`.
> **Notes:** put `HOLD` here to skip a sub-feature; record new-vs-enhancement classification, PR links and blockers.
>
> Stages: **BE** = backend/service + DB · **API** = actions/route handlers + validation + authz · **UT** = unit/integration tests · **FE** = UI · **E2E** = Playwright + axe · **CR** = code review gate


## Module 0: Foundation and Platform

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | Project scaffold | P0 | N/A | N/A | N/A | N/A | N/A | Done | Done | new. Next 16.3.8, React 19.2.8, TS 5.9 strict + noUncheckedIndexedAccess, Tailwind 4.3, cacheComponents on, src/ layout per ARCHITECTURE section 4, @/ alias. typecheck + build green. pnpm 12 supply-chain policy (minimumReleaseAge) forced better-auth 1.7.6 pin |
| 0.2 | Code quality tooling | P0 | N/A | N/A | Done | N/A | N/A | Done | Done | new. ESLint flat + eslint-plugin-boundaries (rules in eslint.boundaries.mjs, 17 fixture tests prove allowed and forbidden imports), Prettier, Husky pre-commit + commit-msg, lint-staged, commitlint (also rejects module numbers in subjects). Known: boundaries 7.2 prints a deprecation warning for mode full |
| 0.3 | Environment config | P0 | Done | N/A | Done | N/A | N/A | Done | Done | new. Zod server/client env, optional-service groups, .env.example documents every var; next dev/build fail with a readable list when DATABASE_URL or BETTER_AUTH_SECRET is missing (verified); 14 unit tests |
| 0.4 | Local infrastructure | P0 | Done | N/A | Blocked | N/A | N/A | Done | Blocked | new. docker-compose.yml (postgres:16-alpine + mailpit v1.31, bound to 127.0.0.1), db:up/down/reset scripts (reset refuses non-local hosts). Blocked: waiting for Docker, cannot run pnpm db:up to verify |
| 0.5 | Database + Prisma baseline | P0 | Done | N/A | Blocked | N/A | N/A | Done | Blocked | new. Prisma 7.10 (pg adapter, prisma-client generator), uuid(7), snake_case maps, init_baseline migration (citext, pg_trgm, store_settings); lib/db.ts singleton, lib/ids.ts UUIDv7. All migrations apply through prisma migrate deploy and the integration suite passes against an in-process PGlite server (verification aid only). Blocked: the run against Docker PostgreSQL |
| 0.6 | Money and core utilities | P0 | Done | N/A | Blocked | N/A | N/A | Done | Blocked | new. lib/money.ts (100% statement/branch coverage enforced), logger (pino, redaction, ALS context), errors, action-result, idempotency (per-actor keys, transactional claim, DB-clock expiry). 62 money tests + core util tests green; idempotency integration tests (replay, mismatch, rollback, expiry, per-actor) pass on PGlite with a single connection, so true concurrent contention is unproven. Blocked: Docker PostgreSQL run |
| 0.7 | Authentication core | P0 | Done | Done | Blocked | N/A | Blocked | Done | Blocked | new. Better Auth 1.7.6: email+password (verification required, min 10 chars, rate limited), Google (optional, never linked to existing accounts, never for staff), reset + verify mail via lib/email (Resend, SMTP/Mailpit, log fallback), scrypt, TOTP plugin, banned users cannot start sessions, getSession()/requireUser(). Review fixed: account-linking takeover, rate limits, verification no auto sign-in. Blocked: sign-up to sign-in integration flow needs Docker. Auth pages for customers come with customer accounts |
| 0.8 | Staff RBAC | P0 | Done | Done | Blocked | Done | Blocked | Done | Blocked | new. staff_members + role_permissions (defaults seeded in migration, drift-guard test), orders.verify granted to owner/admin/manager/support/order_verifier, assertPermission, requireStaff, proxy admin gate (verified 307), admin sign-in + TOTP enrolment pages, pnpm owner:create bootstrap. Review fixed: Google bypass of TOTP for staff, users.role dropped (staff_members is the single source), page-level requireStaff guard test. Blocked: DB-backed RBAC integration and E2E need Docker |
| 0.9 | Outbox + background jobs | P0 | Done | Done | Blocked | N/A | N/A | Done | Blocked | new. outbox_events (in-tx enqueueEvent, immutability trigger, partial index), lease dispatcher with SKIP LOCKED + backoff + poison-event isolation + crash-loop terminal state, Inngest v4 client + cron dispatcher + sample handler, processed_events inbox (runOnce), /api/inngest. 14 unit + integration tests (rollback leaves nothing, double delivery gives one effect, trigger blocks edits) pass on PGlite. Blocked: concurrent dispatchers and handler races need a multi-connection Docker Postgres |
| 0.10 | Audit log | P0 | Done | N/A | Blocked | N/A | N/A | Done | Blocked | new. modules/audit: audit(tx, {actorId, action, entity, entityId, before, after, ip, userAgent}); whole-word secret redaction, exact bigint money, 64KB cap with hash; append-only table (update/delete/truncate blocked by trigger). 12 unit + 4 integration tests (PGlite). Blocked: Docker PostgreSQL run |
| 0.11 | Testing harness | P0 | N/A | N/A | Blocked | N/A | Blocked | Done | Blocked | new. Vitest unit (218), integration harness (Testcontainers, or TEST_DATABASE_URL with a name guard; factories; reset helper) with 61 integration tests green on PGlite, Playwright desktop+mobile with axe helper (26 DB-free E2E green) and auth fixtures (*.db.spec.ts, E2E_WITH_DB=1, unique forwarded address per sign-in). Blocked: Testcontainers startup and the DB-backed E2E specs need Docker |
| 0.12 | CI pipeline | P0 | N/A | N/A | Blocked | N/A | N/A | Done | Blocked | new. .github/workflows/ci.yml (typecheck, lint, format, unit+coverage, integration, build, e2e+axe with Postgres service, informational audit, commitlint), e2e-preview.yml (with Vercel bypass header), dependabot, PR template, docs/runbooks/ci-and-branch-protection.md. Blocked: workflows have not run on GitHub; required checks on main are a repo setting the owner applies (command in the runbook) |
| 0.13 | Observability | P0 | Done | Done | Done | N/A | Blocked | Done | Blocked | new. Sentry (@sentry/nextjs 11) server+edge via instrumentation.ts, client via instrumentation-client.ts, global-error boundary, withSentryConfig from @sentry/nextjs/config, source map upload only when token/org/project exist, scrubbing for errors, transactions and breadcrumbs; /api/health (DB required, Redis optional -> degraded). 20 unit tests; health integration test on PGlite. Inert without DSN. Blocked: DB-backed health E2E needs Docker. Builds took 4 to 9 minutes on this loaded Windows machine |
| 0.14 | Security headers + rate limiting | P0 | Done | Done | Done | N/A | Done | Done | Done | new. Header based CSP (no nonce: ADR-016, Next.js documents nonces as incompatible with PPR), HSTS, nosniff, X-Frame-Options, Referrer/Permissions policy, COOP in next.config; Upstash sliding-window limiter with memory fallback, per-IP and per-account limits on every auth route, trusted-proxy aware client IP (TRUSTED_PROXY). 31 unit tests + E2E for headers, hydration under CSP and 429 behaviour (desktop+mobile) |
| 0.15 | Seed data | P0 | Done | N/A | Blocked | N/A | N/A | Done | Blocked | new. 6 categories, 40 products, 390 variants (colour x size), 176 images (4:5 SVG placeholders in public/seed), 1 warehouse, opening stock with matching ledger, owner account; catalog + stock tables with CHECKs and append-only ledger; seed refuses non-local databases. pnpm db:seed run twice against PGlite (second run skips); 8 unit + 14 integration tests green. Blocked: pnpm db:reset not run (Prisma blocks migrate reset for AI agents without user consent) and Docker PostgreSQL run |

## Module 1: Design System and Brand UI

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Design tokens | P0 | N/A | N/A | Done | Done | Done | Done | Done | enhancement (replaces the minimal foundation tokens). Tailwind v4 @theme: palette, stone scale, fluid type, container/gutters, radius 0-2px, one float shadow, motion tokens, semantic surfaces with admin dark theme and ink editorial tone. 47 token tests: AA contrast of every text pair in light/dark/ink, 3:1 for control borders and the focus ring, tokens-only guard (no raw hex or arbitrary colours), swatches match tokens. Added gold-strong and warning-strong for small text (spec gold 3.0:1 and warning 4.2:1 fail AA on ivory); line-strong darkened to meet 3:1. code-reviewer and premium-ui-qa findings fixed |
| 1.2 | Fonts and base styles | P0 | N/A | N/A | Done | Done | Done | Done | Done | new. next/font self-hosted Cormorant Garamond (300-600), Manrope (variable) and a non-preloaded Noto Sans Bengali used only for the taka sign; latin subsets, swap, adjusted fallback metrics; base typography, 2px gold focus ring offset 2px, selection colour, type-* roles. E2E asserts the loaded font families and the ring. Review findings fixed |
| 1.3 | UI primitives | P0 | N/A | N/A | Done | Done | Done | Done | Done | new. Button (variants, loading, asChild, disabled), IconButton, Input, Textarea, FormField, Label, Select, Checkbox, RadioGroup, Switch, Dialog, Sheet, Popover, Tooltip, Accordion, Tabs, Toast (sonner), Skeleton, Badge, FilterChip, Breadcrumb, Price (lib/money, taka sign), Rating, Pagination, EmptyState, Spinner on Radix. 28 SSR unit tests plus Playwright keyboard/focus-return tests on the style guide. Review findings fixed (link button sizing, asChild disabled, focus indicators on select/palette rows) |
| 1.4 | Motion utilities | P0 | N/A | N/A | Done | Done | Done | Done | Done | new. Reveal (once; never hides content without JS, on screen or under reduced motion), ImageFrame (4:5, zoom, crossfade), drawer keyframes, useReducedMotion, lib/motion (runViewTransition, viewTransitionName), global reduced-motion rule. 11 unit tests; E2E checks transitions collapse under reduced motion |
| 1.5 | Storefront shell | P0 | N/A | N/A | Done | Done | Done | Done | Done | new. (storefront) route group: skip link, AnnouncementBar (max 3, pause/step, stops for reduced motion), Header (transparent over hero to solid after 80px), MegaMenu (disclosure pattern with scrim, mouse hover only for mouse pointers, Escape returns focus), full-screen MobileMenu, Footer, ConciergeButton (WhatsApp via NEXT_PUBLIC_WHATSAPP_NUMBER, else /contact; hidden on checkout). Desktop+mobile Playwright incl. axe with menus open. Newsletter form validates only; sign-up wiring is later marketing work. premium-ui-qa: axe clean at all sizes; findings fixed (44px targets, scrim, hero, taka glyph, pinned mobile links) |
| 1.6 | Admin shell | P0 | N/A | N/A | Done | Done | Blocked | Done | Blocked | new. Admin shell: sidebar by permission (unbuilt screens shown as Soon), top bar, command palette (Ctrl/Cmd+K, returns focus), light/dark with no flash, DataTable (sort, select, loading/empty/error, CSV export with formula guard; ADR-019), KpiCard, FormSection/FormActions, PageHeader, AccessDenied boundary. 22 admin unit tests + 15 bypass E2E on desktop+mobile (axe light and dark). E2E Blocked: waiting for Docker, the real sign-in and role spec (admin-shell.db.spec.ts) is written but cannot run; rendering is verified through the permissionless test identity (ADR-020) |
| 1.7 | Internal style guide page | P0 | N/A | N/A | Done | Done | Blocked | Done | Blocked | new. /admin/style-guide (any active staff): 11 sections covering every component and state, light and dark. 28 visual snapshots (E2E_VISUAL=1, win32 baselines, stable on rerun) and 22 interaction/axe specs on desktop+mobile. E2E Blocked: waiting for Docker, access checks behind a real login (anonymous redirect, customer denied) are in admin-shell.db.spec.ts and have not run |
| 1.8 | System pages | P0 | N/A | N/A | Done | Done | Done | Done | Done | new. Editorial 404 (inside the storefront shell, also for notFound()), storefront error boundary, self-contained global-error, maintenance page served with 503 + Retry-After by the proxy when MAINTENANCE_MODE=1 (console, health, webhooks, jobs and auth keep working; copy says placed orders are unaffected and still confirmed by people). 9 unit + 7 proxy tests, 6 Playwright runs with axe. A server-level run with MAINTENANCE_MODE=1 has not been done (covered by proxy unit tests) |

## Module 2: Catalog

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Categories admin | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.2 | Product + variants admin | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.3 | Media management | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.4 | Size charts | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.5 | Collections admin | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.6 | Product relations | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.7 | Slug redirects | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.8 | Bulk import/export | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.9 | Product listing page (PLP) | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.10 | Product card | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.11 | Product detail page (PDP) | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.12 | Live price/stock island | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.13 | Recently viewed | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 2.14 | Product SEO | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 3: Inventory and Purchasing

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Stock levels and ledger | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.2 | Manual adjustments | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.3 | Atomic reserve/commit/release | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.4 | Suppliers | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.5 | Purchase orders | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.6 | Landed costs | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.7 | Goods receipt + weighted avg cost | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.8 | Low-stock alerts | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.9 | Inventory valuation and aging | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 3.10 | Multi-location and transfers | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 4: Cart and Checkout

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Cart service | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.2 | Cart drawer and page | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.3 | Address model (BD hierarchy) | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.4 | Shipping zones and rates | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.5 | Checkout page | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.6 | Order placement transaction | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.7 | Order confirmation page | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 4.8 | Checkout abuse protection | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 5: Payments

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Payment provider interface | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.2 | Cash on Delivery | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.3 | SSLCommerz (cards, bKash, Nagad) | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.4 | Payment fees capture | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.5 | Refunds | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.6 | Failed/expired payment recovery | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.7 | Stripe (international) | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 5.8 | bKash direct (tokenized) | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 6: Orders, Fulfillment and Shipping

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Order state machine | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.2 | Admin order list | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.3 | Admin order detail | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.4 | Order verification queue | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.5 | Manual order entry | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.6 | Invoices and packing slips | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.7 | Courier interface + Pathao | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.8 | Steadfast courier | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.9 | Packaging cost application | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.10 | COD remittance reconciliation | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.11 | RTO handling | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.12 | Returns and exchanges | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.13 | Verification checklist and outcomes | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.14 | Edit order during verification | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 6.15 | Verification SLA and escalation | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 7: Customer Accounts

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Auth pages | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.2 | Account dashboard | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.3 | Order history and tracking | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.4 | Address book | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.5 | Wishlist | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.6 | Returns self-service | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.7 | Store credit and gift card balance | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.8 | Admin customer management | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 7.9 | Data export / account deletion | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 8: Content and Landing Experience

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | Section-block page builder | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.2 | Homepage sections | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.3 | Navigation and announcements | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.4 | Static and legal pages | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.5 | Lookbooks | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.6 | Journal (blog) | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.7 | Newsletter signup | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 8.8 | Cookie consent | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 9: Search and Discovery

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 9.1 | Search index | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 9.2 | Search overlay | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 9.3 | Search results page | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 9.4 | Facet counts | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 9.5 | Recommendations | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 9.6 | Search analytics | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 10: Promotions and Pricing

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 10.1 | Discount engine | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.2 | Discount codes at checkout | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.3 | Automatic promotions | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.4 | Buy X Get Y | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.5 | Compare-at / sale display | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.6 | Gift cards | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 10.7 | Store credit | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 11: Finance and Cost Tracking

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 11.1 | Expense categories | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.2 | Expense entry | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.3 | Recurring expenses | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.4 | Marketing campaigns | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.5 | Order cost lines | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.6 | Order profit breakdown | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.7 | Daily financial rollups | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.8 | Profit & Loss report | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.9 | Product profitability | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.10 | Campaign ROAS and CAC | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.11 | Expense analytics | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.12 | Cash-flow view | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 11.13 | Finance permissions | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 12: Reviews and Social Proof

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 12.1 | Review submission | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 12.2 | Moderation | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 12.3 | PDP review display | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 12.4 | Review request email | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 12.5 | UGC / Instagram grid | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 13: Notifications and Marketing Automation

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 13.1 | Email infrastructure | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.2 | Transactional emails | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.3 | SMS notifications | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.4 | Abandoned cart recovery | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.5 | Back-in-stock notifications | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.6 | Admin alerts | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 13.7 | Marketing pixels + CAPI | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 14: SEO and Performance Hardening

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 14.1 | Metadata framework | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.2 | Structured data | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.3 | Sitemaps and robots | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.4 | Faceted navigation rules | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.5 | Product feeds | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.6 | OG images | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.7 | Performance budgets | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 14.8 | Image pipeline audit | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 15: Admin Dashboard, Analytics and Settings

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 15.1 | Dashboard KPIs | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.2 | Sales analytics | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.3 | Store settings | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.4 | Staff management | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.5 | Audit log viewer | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.6 | System health page | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 15.7 | Verification performance report | P1 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 16: Launch Readiness

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 16.1 | Security review | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.2 | Accessibility audit | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.3 | Load test | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.4 | Backups and restore drill | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.5 | Runbooks | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.6 | Production cutover | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 16.7 | Legal and compliance | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 17: Future / Scale (P2)

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 17.1 | Bangla localization | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 17.2 | Multi-currency display | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 17.3 | Loyalty program | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 17.4 | Pre-orders and limited drops | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 17.5 | PWA enhancements | P2 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

---

## Summary

By priority: **P0 119** · **P1 28** · **P2 13** (total 160)

| Release | Modules | Sub-features | Done |
|---|---|---|---|
| R1 Foundation | 0, 1 | 23 | 10 |
| R2 Sellable MVP | 2, 3, 4, 5, 6, 7 | 64 | 0 |
| R3 Premium launch | 8, 9, 11, 14, 16 | 42 | 0 |
| R4 Growth | 10, 12, 13, 15 | 26 | 0 |
| R5 Scale | 17 | 5 | 0 |

> Releases group modules by when they're needed. P1/P2 items inside R2/R3 modules may ship after launch.
