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
| OD-5 | Hosting budget? | **Vercel Pro + Neon (Singapore)** | Alternative: Docker on VPS (cheaper, more ops work) |
| OD-6 | VAT registered? Prices tax-inclusive? | Tax-inclusive, VAT configurable (off until confirmed) | Invoice format |
| OD-7 | Other sales channels (Facebook/Instagram DMs, physical store)? | **Yes**: admin manual order entry with `channel` field; POS out of scope | Module 6 manual order flow |
| OD-8 | Approx. catalog size and monthly orders at launch? | < 1,000 SKUs, < 3,000 orders/month | Search engine choice, infra sizing |
| OD-9 | Fonts: free (Cormorant + Manrope) or licensed premium serif? | Free at launch | Visual polish |
| OD-10 | Return/exchange policy window? | 7 days exchange, size exchange free once | Returns module rules, PDP copy |
| OD-11 | Order verification details: working hours, SLA, escalation threshold? | 10 am – 9 pm, 2 working-hour SLA, manager-review flag after 3 failed attempts, manual-order self-verify **off**. **Auto-cancel: decided NO** (owner, 2026-10-01) | Settings defaults only |
| OD-12 | Nonce based CSP? | **No** until Next.js supports nonces with Partial Prerendering (see ADR-016) | Stricter script policy, slower uncached pages |

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
- **Status:** Accepted (2026-10-02). Deviates from the sub-feature wording "CSP (nonce)".
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

### OD-12 Nonce based CSP
Revisit ADR-016 when Next.js supports nonces with Partial Prerendering. Default until then: header based CSP without nonces.
