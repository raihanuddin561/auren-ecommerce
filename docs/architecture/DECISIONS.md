# AUREN — Architecture Decision Log

Format: each decision has an ID, status (`Accepted` / `Proposed` / `Superseded`), context, decision, and consequences. New decisions get appended; old ones are never deleted (mark them superseded).

---

## Open decisions (need business owner input; defaults applied until answered)

| ID | Question | Default assumed | Impact if different |
|---|---|---|---|
| OD-1 | Primary market and currency? | **Bangladesh, BDT**; international orders later | Payment/courier adapters, address model, tax |
| OD-2 | Which payment methods at launch? | **COD + SSLCommerz** (cards, bKash, Nagad); Stripe adapter for international later | Module 5 scope |
| OD-3 | Which couriers? | **Pathao + Steadfast** + manual | Module 6 scope |
| OD-4 | Languages? | **English at launch**, Bangla later under `/bn` | i18n effort; URLs stay stable either way |
| OD-5 | Hosting budget? | **Vercel Pro + Supabase Postgres** (2026-10-03, ADR-025; replaces Neon) and Vercel Blob for media (ADR-026) | Alternative: Docker on VPS (cheaper, more ops work) |
| OD-6 | VAT registered? Prices tax-inclusive? | Tax-inclusive, VAT configurable (off until confirmed) | Invoice format |
| OD-7 | Other sales channels (Facebook/Instagram DMs, physical store)? | **Yes**: admin manual order entry with `channel` field; POS out of scope | Module 6 manual order flow |
| OD-8 | Approx. catalog size and monthly orders at launch? | < 1,000 SKUs, < 3,000 orders/month | Search engine choice, infra sizing |
| OD-9 | Fonts: free (Cormorant + Manrope) or licensed premium serif? | Free at launch | Visual polish |
| OD-10 | Return/exchange policy window? | 7 days exchange, size exchange free once | Returns module rules, PDP copy |
| OD-11 | Order verification details: working hours, SLA, escalation threshold? | 10 am – 9 pm, 2 working-hour SLA, manager-review flag after 3 failed attempts, manual-order self-verify **off**. **Auto-cancel: decided NO** (owner, 2026-10-01) | Settings defaults only |
| OD-12 | Nonce based CSP? | **Closed (ADR-022):** yes for the dynamic sections (`/admin`, `/checkout`, `/account`, `/api`), no for the prerendered storefront | Dynamic sections are rendered per request; storefront keeps `unsafe-inline` for bootstrap scripts |

---

## Accepted decisions

### ADR-001 Modular monolith on Next.js App Router
- **Context:** Small team, one product, needs speed and SEO.
- **Decision:** A single Next.js app containing storefront, admin and API, split into domain modules with enforced import boundaries.
- **Consequences:** One deploy and one DB; modules can be extracted later. Requires lint-enforced boundaries.

### ADR-002 PostgreSQL + Prisma, money as BIGINT minor units
- **Decision:** Prisma for schema/migrations/CRUD; TypedSQL for finance reports. Money as `BIGINT` minor units + currency.
- **Consequences:** No float rounding bugs; reports run fast as raw SQL.

### ADR-003 Better Auth for customer and staff auth
- **Decision:** Better Auth with DB sessions; email+password, Google, phone OTP; RBAC roles for staff; 2FA mandatory for staff.
- **Consequences:** No per-user SaaS cost; we own the auth tables.

### ADR-004 Server Components first; Server Actions for mutations; Route Handlers for webhooks/feeds
- **Consequences:** Minimal client JS; all mutations validated with Zod and authorized server-side.

### ADR-005 Cache Components with tag-based invalidation
- **Decision:** Catalog/content reads use `"use cache"` + `cacheTag`; admin writes call `revalidateTag`. Stock/price render in small dynamic islands.
- **Consequences:** Near-static speed with fresh availability.

### ADR-006 Transactional outbox + Inngest for side effects
- **Decision:** Domain events are written in the same transaction as the state change, then dispatched to Inngest for emails, SMS, CAPI, finance rollups and courier sync.
- **Consequences:** No lost emails or events when a request crashes; handlers must be idempotent.

### ADR-007 Payment provider adapter interface
- **Decision:** `PaymentProvider { createSession, verify, handleWebhook, refund, getFee }`. Launch with COD + SSLCommerz; Stripe/bKash-direct are pluggable.
- **Consequences:** Hosted payment pages keep PCI scope at SAQ-A; amount always verified server-side.

### ADR-008 Courier provider adapter interface
- **Decision:** `CourierProvider { quote, book, track, cancel, parseWebhook }`. Launch with Pathao + Steadfast + manual.
- **Consequences:** Real shipping cost captured per shipment for profit tracking.

### ADR-009 Profit derived from source records, rolled up daily
- **Decision:** COGS snapshot on order lines; costs as `order_cost_lines`; opex as `expenses`; `daily_financial_summaries` recomputed per affected date. Revenue recognized on delivery by default.
- **Consequences:** Every profit number is traceable to its source; no manually typed totals.

### ADR-010 Weighted average costing with landed cost
- **Decision:** Inventory valued at weighted average cost, including allocated freight, duty and inbound costs.
- **Consequences:** Simple and accurate for apparel. FIFO is not needed at this scale.

### ADR-011 Tailwind v4 + shadcn/ui (Radix) restyled to AUREN tokens
- **Consequences:** Accessible primitives, fully custom premium look, design tokens in CSS.

### ADR-012 Cloudinary for media behind `MediaProvider`
- **Status:** Superseded by ADR-026 (2026-10-03): Vercel Blob in production, local files in development. The `MediaProvider` adapter idea stays.
- **Consequences:** AVIF/WebP + art direction out of the box; swappable for S3/R2 later.

### ADR-013 Postgres full-text search at launch
- **Consequences:** No extra infra. Revisit at about 5k SKUs or when relevance needs grow (Meilisearch).

### ADR-014 Testing pyramid and quality gates
- **Decision:** Vitest unit, Testcontainers integration on real Postgres, Playwright E2E + axe + visual snapshots, Lighthouse CI budgets. All gates block merge.

### ADR-015 Mandatory staff verification for every order
- **Context:** The business owner requires that every order placed (any channel, any payment method) is verified and confirmed by an admin or designated staff member before fulfillment. In the primary market, this also cuts fake COD orders and RTO losses.
- **Decision:** Orders are never auto-confirmed. New statuses `under_verification` and `on_hold`; `orders.verify` permission (default: owner, admin, manager, support, plus an optional dedicated `order_verifier` role); verification queue with claim/assign, a required checklist, logged contact attempts, edit-then-confirm, required cancel reasons, a configurable SLA with overdue escalation to managers, and **no automatic cancellation** (owner decision, 2026-10-01): only staff cancel orders. Stock is held during verification. Server-side Purchase analytics fire on confirmation. See ARCHITECTURE §6.1.
- **Consequences:** Fulfillment only sees verified orders; staffing is needed during business hours; time-to-verify becomes a tracked KPI; Supersedes the "auto-confirm prepaid" behaviour in the v1.0 baseline.

### ADR-016 Content-Security-Policy without per-request nonces
- **Status:** Superseded in part by ADR-022 (2026-10-02): the static header remains for the prerendered storefront only; dynamic sections use a per-request nonce. Originally accepted 2026-10-02; deviated from the sub-feature wording "CSP (nonce)".
- **Context:** Next.js documents that nonce based CSP requires every page to be rendered per request and is incompatible with Partial Prerendering, because the prerendered shell is built before any request exists. ADR-005 (Cache Components) depends on exactly that static shell for LCP, CDN caching and cheap traffic spikes.
- **Decision:** Ship the CSP as a static response header from `next.config.ts` (built by `src/lib/security/headers.ts`): `default-src 'self'`, scripts from `'self'` plus inline bootstrap scripts (`'unsafe-inline'`, plus `'unsafe-eval'` in development only), `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, images and media limited to self and Cloudinary, `connect-src` limited to self and the Sentry ingest host. HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and COOP are sent on every response. `buildCsp` already accepts a nonce, so the policy can switch to nonce plus `strict-dynamic` per route if Next.js ever supports it with PPR.
- **Consequences:** An XSS bug could still run inline script, so the remaining defence is input handling (Zod, sanitised markdown, React escaping) and the rest of the policy limiting where data can be sent. Third-party scripts added later (GA4, Meta Pixel) must be added to `script-src`/`connect-src` deliberately. Revisit when Next.js adds nonce support for prerendered shells, or when SRI based CSP leaves experimental.

### ADR-017 Identity: staff_members is the source of truth, customer-only social login
- **Status:** Accepted (2026-10-02).
- **Decision:** (1) A user is staff if and only if an active `staff_members` row exists; `users.role` from the first data model draft was dropped to avoid two sources of truth. (2) `users.two_factor_enabled` (maintained by the Better Auth two-factor plugin) is the single record of staff TOTP enrolment; staff are held at `/admin/security` until it is true. (3) Google sign-in is for customers only: account linking is disabled, and a social account can never be attached to a staff user, because social sign-in skips the TOTP challenge and automatic linking enables pre-registration account takeover. (4) Verification and reset emails are sent by Better Auth callbacks directly (Resend, SMTP or log), not through the outbox, because those callbacks run outside any transaction and a lost mail is recovered by requesting it again. (5) Credential accounts use `account_id = user id`, as Better Auth requires. (6) The first owner is created with `pnpm owner:create`.
- **Consequences:** Customer account linking must be designed properly (verified email on both sides) before it is enabled. Deactivating a staff member takes effect on the next request.

### ADR-018 Outbox dispatcher: leases, isolation and an inbox for consumers
- **Status:** Accepted (2026-10-02). Refines ADR-006.
- **Decision:** `outbox_events` rows are immutable (a trigger blocks content edits, deletes and truncation). A dispatcher leases a batch with `FOR UPDATE SKIP LOCKED`, sends outside any transaction, then marks rows dispatched; failures back off exponentially up to 12 attempts and then become `failed` (never deleted). A batch rejected by the job runner is retried one event at a time so a poison event cannot burn its neighbours' attempts. The Inngest event id equals the outbox id so duplicate sends collapse. Consumers claim `(consumer, event id)` in `processed_events` inside the same transaction as their database effects (`runOnce`), which makes redelivery harmless. Submit endpoints use `runIdempotent`, namespaced per actor, with the claim in the same transaction as the work and expiry measured by the database clock.
- **Consequences:** Delivery is at least once by design. Dispatched outbox rows and `processed_events` need a retention job before volume grows. Cron granularity is one minute; latency sensitive events should also nudge the dispatcher after commit.

### ADR-019 Admin DataTable is a small in-house component, not TanStack Table
- **Status:** Accepted (2026-10-02). Deviates from "Tables: TanStack" in DESIGN-SYSTEM section 4.11.
- **Context:** The installed TanStack Table is v9, whose API (feature registration, `useTable`, new generics) differs from the v8 material the project docs assume, and whose column definitions are functions that cannot cross the server/client boundary anyway.
- **Decision:** `components/admin/data-table.tsx` is a controlled, accessible table (caption, aria-sort, selection, loading/empty/error states, CSV export with formula-injection guard). Sorting can be in-memory or controlled for server-side sorting; filtering, saved views and pagination live in the page (URL state) and reach the table through the toolbar slot and props.
- **Consequences:** No virtualisation or column resizing yet. If a screen needs them (large inventory grids), adopt TanStack Table v9 behind the same `DataTableColumn` shape and record the change here.

### ADR-020 Test-only staff bypass for database-free browser tests
- **Status:** Accepted (2026-10-02).
- **Context:** Visual snapshots and accessibility scans of admin screens need a signed-in staff member, which needs PostgreSQL (not available on every machine, and slow in CI for pure rendering checks).
- **Decision:** `E2E_STAFF_BYPASS=1` makes `getStaff()` and the admin proxy accept an identity with **no permissions**. It works only when APP_URL is localhost and the process is not on Vercel; `parseServerEnv` (run by `next dev`, `build` and `start`) refuses to boot when the flag is set anywhere else. Playwright starts a separate server on PORT+1 with the flag; real sign-in and role checks stay in `*.db.spec.ts`.
- **Consequences:** The bypass cannot read or change business data because it holds no permissions. Any future code that treats "signed-in staff" as sufficient for data access must still call `assertPermission`.

### ADR-021 Two database roles: owner for migrations, DML-only role for the app
- **Status:** Accepted (2026-10-02). Refines ADR-006 and ADR-018 (audit finding H3).
- **Context:** The application connected as the role that owns the schema, so a SQL injection or a code bug could `TRUNCATE`, `DROP TRIGGER` or `ALTER TABLE ... DISABLE TRIGGER` and rewrite `audit_logs`, `stock_movements` or `outbox_events`. Triggers alone are not a defence against an owner.
- **Decision:** `auren_migrator` owns the schema and runs migrations (`DIRECT_URL`); `auren_app` runs the application (`DATABASE_URL`) with `SELECT/INSERT/UPDATE/DELETE` only, owns nothing, has no `TRUNCATE`, `TRIGGER` or `REFERENCES`, and cannot create objects (`CREATE` and `TEMPORARY` revoked from PUBLIC). Ledgers lose `UPDATE/DELETE` for `auren_app` (`audit_logs`, `stock_movements`, `processed_events`); `outbox_events` keeps column-level `UPDATE` on the six delivery columns only and a dispatched event can never change again; `role_permissions` is read-only for the app. Roles are created `NOLOGIN` by a migration and given passwords out of band (`pnpm db:roles`, runbook). A migration that adds a ledger must `REVOKE UPDATE, DELETE ... FROM auren_app`; the migration itself fails the deployment if the revokes did not take effect, and an integration test covers every guarded table.
- **Consequences:** Seeds and `pnpm owner:create` run as `auren_app` (they only write ordinary tables). Retention deletes for the outbox and inbox need a migrator-owned function (security operations work). `inventory_levels` and `staff_members` are still writable by the app, so balances and roles rely on service rules, DB constraints in the inventory work, and audit alerts (insider-risk work). Roles are cluster-wide, so databases on one server share passwords.

### ADR-022 Nonce CSP for the dynamic sections, static CSP for the storefront
- **Status:** Accepted (2026-10-02). Supersedes ADR-016 for `/admin`, `/checkout`, `/account` and `/api`; closes OD-12 (audit finding M4).
- **Context:** ADR-016 put one static CSP with `'unsafe-inline'` scripts on every response because a prerendered (PPR) shell cannot carry a per-request nonce. That is the right trade for the cached storefront, but it leaves the pages that handle staff sessions, customer accounts and payments with the weakest script policy, where an XSS would be worth the most.
- **Decision:** Two regimes. (1) Storefront: unchanged static header from `next.config.ts`, scoped by path to everything outside the dynamic sections. (2) Dynamic sections: `proxy.ts` generates a 128-bit nonce for every request and sets `Content-Security-Policy` with `script-src 'self' 'nonce-<n>' 'strict-dynamic'` (no `'unsafe-inline'`; development adds `'unsafe-eval'`) on the request (so Next.js stamps its own scripts) and on the response; the nonce is also available as `x-nonce` for server components that emit inline scripts. `/api` responses get `default-src 'none'; frame-ancestors 'none'` instead (data, not documents). A dynamic section must not be prerendered: `src/app/admin/layout.tsx` awaits `connection()` and sets `instant = false` (a blocking route); `/checkout` and `/account` layouts must do the same when they are built (a lint test enforces it). Styles keep `'unsafe-inline'` (Tailwind and component libraries inject style attributes). Also added: `Cross-Origin-Resource-Policy: same-origin` on the dynamic sections only (email clients and social crawlers must still load public images), `Referrer-Policy: no-referrer` on pages whose URL carries a token (`/reset-password`, `/verify-email`, `/track`), and a Permissions-Policy that denies every powerful feature except `payment=(self)`. Header rules are non-overlapping so the result never depends on rule order.
- **Consequences:** The console, checkout and account pages are rendered on every request (no CDN caching, a static shell is not possible); they were dynamic in practice already. An inline script in those sections needs the nonce (read `x-nonce`), a third-party script (analytics, payment SDK) must be loaded by a nonced script or added to `script-src` deliberately. If Next.js adds nonce support for PPR shells, or SRI-based CSP leaves experimental, the storefront can move to a strict policy too.

### ADR-023 Insider-risk controls: maker-checker, audit alerts, network allowlist
- **Status:** Accepted (2026-10-03).
- **Context:** Most damage in a shop with staff comes from inside: a refund to a friend, an export sold on, a permission quietly widened, an order confirmed without checking. The previous controls (permissions, audit log) record these but do not stop or announce them.
- **Decision:** (1) **Maker-checker:** actions above a threshold (hard-capped in code: 5,000.00 for refunds, 10,000.00 for adjustments, so a settings edit cannot switch it off; edits to settings raise an alert) (`approvals.thresholds` in settings; defaults refund 5,000.00 and stock adjustment 10,000.00 in the base currency) need an `approval_requests` row decided by a different staff member holding `approvals.decide`; the database refuses decider = requester, edits after a decision and deletes, and an approval is single-use, covers only its amount and currency, and expires 7 days after the decision. Deciding needs step-up (INV-A6) in the action that calls the service. Unknown kinds fail safe (everything needs approval). (2) **Audit alerts:** every five minutes a job scans new audit rows and raises `security.alert` events (ids and counts only) emailed to the owner for refunds, exports, role changes, `role_permissions` edits, repeated wrong step-up answers (3 in 10 minutes) and unusual verification volume (40 in an hour). Database triggers write an audit row for every change to `role_permissions` and for every change to a staff member's role, active flag or account (`staff_members`), whoever makes it (raw SQL included), because the application cannot edit that table and a change outside a reviewed migration is itself the signal. (3) **Optional network allowlist:** `PRIVILEGED_IP_ALLOWLIST` limits the owner and finance roles to listed addresses or ranges (IPv6 at /64); from elsewhere they get a 404; a malformed list denies everyone.
- **Consequences:** Small teams need a second approver for large refunds: with a single staff member nobody can approve, so the thresholds must be raised in settings until a second approver exists. Alerts rely on audit actions being named consistently (`order.refund`, `*.export`, `staff.role_changed`). The allowlist assumes a trustworthy client address (`vercel` or `hops:N`).

### ADR-024 Event retention through a migrator-owned function
- **Status:** Accepted (2026-10-03). Completes ADR-018 and ADR-021.
- **Context:** The outbox and the consumer inbox grow with every order, but the application role may not delete them (ADR-021) and the triggers forbid deletes.
- **Decision:** `purge_finished_events(retain_days)` is a SECURITY DEFINER function owned by the schema owner (`search_path = pg_catalog, public, pg_temp`, EXECUTE granted to `auren_app` only). It deletes dispatched outbox rows and consumer claims older than `retain_days` (minimum 7, default 30 in the daily job), in batches of 5,000 so a call stays inside the application statement timeout. `failed` and pending events are never deleted, and a claim is kept while its outbox event is not finished, so a late manual replay cannot run a handler twice. The outbox guard trigger allows a delete only for a dispatched row, inside that function (a transaction-local setting) and never for `auren_app`.
- **Consequences:** Retention is bounded by the batch limit per run (the job runs daily and drains the backlog over several runs). Replaying a failed event after its claims were purged is safe because failed events keep their claims. Moving the retention period needs a code change.

### ADR-025 Supabase Postgres in production, local PostgreSQL in development
- **Status:** Accepted (2026-10-03). Supersedes the Neon (Singapore) hosting choice in ARCHITECTURE section 2 and OD-5. Builds on ADR-021.
- **Context:** The owner chose Supabase for the production database. Supabase also exposes every table of the public schema over an HTTP Data API using the roles `anon` and `authenticated`, which AUREN never uses. Local development uses the owner's own PostgreSQL service (no Docker); CI keeps a Postgres service container.
- **Decision:** `DATABASE_URL` is the transaction pooler (port 6543, Prisma without prepared statements, small `DB_POOL_MAX`) and connects as `auren_app`. `DIRECT_URL` is the direct or session connection (5432) used only by migrations, as `auren_migrator`. Production boot refuses equal URLs, a missing `sslmode=require` (or stronger), a local host, the wrong port on a Supabase host and a pool above 10. The migration `secure_public_schema` enables Row Level Security on every public table with a single policy for `auren_app`, revokes all privileges of `anon`, `authenticated` and `service_role` (only when those roles exist) and sets default privileges so later tables are covered; every migration that creates a table calls `auren_secure_table`. An integration test fails when a table lacks RLS or an API role holds a privilege. The Data API is switched off in the dashboard and the `service_role` key is never used by the app.
- **Consequences:** Defence in depth: even with the Data API accidentally on, the database refuses it. Backups are Supabase PITR plus the nightly logical dump. Migrations never run through the pooler. Steps: docs/runbooks/database-roles.md and docs/runbooks/local-database.md.

### ADR-026 Vercel Blob in production, local filesystem in development, behind `MediaProvider`
- **Status:** Accepted (2026-10-03). Supersedes ADR-012 (Cloudinary).
- **Context:** One vendor less and no transformation bill; product image variants are produced at upload time and served through `next/image`.
- **Decision:** `lib/media` defines `MediaProvider` (put, delete, getUrl, plus private put and signed read for receipts and invoices). `BLOB_READ_WRITE_TOKEN` present selects Vercel Blob (required in production, boot guard); absent selects the local filesystem under `MEDIA_LOCAL_DIR` (default `.local-media`, git-ignored), served by a route handler that cannot leave that directory. Uploads accept jpeg, png, webp and avif only (never SVG), are identified by magic bytes, size-capped, re-encoded with sharp to strip EXIF and GPS, and stored under random keys, never user filenames. Returned URLs are checked against the store host. Receipts and invoices are private and delivered only through authenticated, short-lived links. `public/seed` SVG placeholders are development only.
- **Consequences:** No on-the-fly transformations. Moving to S3 or R2 later means one new adapter. CSP `img-src` allows `https://*.public.blob.vercel-storage.com`.

### OD-12 Nonce based CSP
Closed by ADR-022: nonces for the dynamic sections, static header for the prerendered storefront. Revisit the storefront half when Next.js supports nonces with Partial Prerendering.
