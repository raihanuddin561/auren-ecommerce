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
