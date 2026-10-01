# AUREN — Feature List (Implementation Contract)

> Source of truth for **what** gets built. Status lives in [feature-progress.md](./feature-progress.md); the running log is in [progress-tracker.md](./progress-tracker.md).
> Architecture: [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) · Data: [DATA-MODEL.md](../docs/architecture/DATA-MODEL.md) · Design: [DESIGN-SYSTEM.md](../docs/design/DESIGN-SYSTEM.md)
>
> **Priority:** `P0` = required for launch · `P1` = within ~4 weeks after launch · `P2` = growth phase
> **Module numbers are for tracking only.** Never use them in routes, component names, UI copy or test names.
> Every sub-feature must meet the **Definition of Done** in ARCHITECTURE.md §12.

## Release plan

| Release | Modules | Outcome |
|---|---|---|
| **R1: Foundation** | 0, 1 | Repo, CI, DB, auth skeleton, design system live in a style guide |
| **R2: Sellable MVP** | 2, 3, 4, 5, 6, 7 (P0) | Customers can browse, buy (COD + online), get delivered; staff can manage catalog, stock, orders |
| **R3: Premium launch** | 8, 9, 11 (P0), 14, 16 | CMS landing, search, profit tracking, SEO hardening, launch checklist → **public launch** |
| **R4: Growth** | 10, 12, 13, 15 + all P1 | Promotions, reviews, automation, analytics |
| **R5: Scale** | all P2 | Loyalty, Bangla, multi-currency, advanced personalization |

---

## Module 0: Foundation and Platform

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 0.1 | Project scaffold | P0 | Next.js (latest) App Router + TS strict + pnpm; `src/` layout per ARCHITECTURE §4; path aliases `@/` |
| 0.2 | Code quality tooling | P0 | ESLint flat config incl. `eslint-plugin-boundaries` enforcing module layering; Prettier; Husky + lint-staged; Commitlint |
| 0.3 | Environment config | P0 | `lib/env.ts` Zod-validated server/client env; `.env.example` documented; build fails on missing vars |
| 0.4 | Local infrastructure | P0 | `docker-compose.yml` with Postgres 16 + Mailpit; `pnpm db:up/db:reset` scripts |
| 0.5 | Database + Prisma baseline | P0 | Prisma schema with conventions (UUIDv7, snake_case maps, timestamps); first migration; `lib/db.ts` singleton |
| 0.6 | Money and core utilities | P0 | `lib/money.ts` (minor units, add/multiply/allocate/format, banker's rounding) with 100 % unit coverage; `lib/logger.ts`; `lib/idempotency.ts` |
| 0.7 | Authentication core | P0 | Better Auth: email+password, Google OAuth, email verification, password reset; session helpers `getSession()/requireUser()` |
| 0.8 | Staff RBAC | P0 | `staff_members`, roles (incl. `order_verifier`) & permissions (incl. `orders.verify`) seeded; `assertPermission()`; `/admin` gated in middleware + layout; staff 2FA (TOTP) enforced |
| 0.9 | Outbox + background jobs | P0 | `outbox_events` written in-transaction; Inngest client + dispatcher + one sample handler; retries & idempotency proven by test |
| 0.10 | Audit log | P0 | `audit()` helper records actor, action, before/after for admin mutations |
| 0.11 | Testing harness | P0 | Vitest unit; Testcontainers Postgres integration setup; Playwright with auth fixtures; axe helper |
| 0.12 | CI pipeline | P0 | GitHub Actions: typecheck, lint, unit, integration, build, E2E on preview; required checks on `main` |
| 0.13 | Observability | P0 | Sentry (client/server/edge), source maps, `/api/health` (DB + Redis) |
| 0.14 | Security headers + rate limiting | P0 | CSP (nonce), HSTS etc. in `next.config`/middleware; Upstash rate limiter utility applied to auth routes |
| 0.15 | Seed data | P0 | Realistic menswear seed: 6 categories, 40 products, variants, images, 1 location, staff owner account |

## Module 1: Design System and Brand UI

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 1.1 | Design tokens | P0 | Tailwind v4 `@theme` with colors, fluid type, spacing, radius, motion tokens per DESIGN-SYSTEM §2; contrast verified |
| 1.2 | Fonts and base styles | P0 | `next/font` self-hosted serif + sans, subsets, no CLS; base typography, focus ring, selection color |
| 1.3 | UI primitives | P0 | Button, Input, Select, Checkbox, Radio, Textarea, Dialog, Sheet, Popover, Tooltip, Accordion, Tabs, Toast, Skeleton, Badge, Breadcrumb, Price, Rating, all with states + a11y |
| 1.4 | Motion utilities | P0 | Reveal-on-scroll, image hover, drawer transitions, View Transition helper; reduced-motion respected |
| 1.5 | Storefront shell | P0 | AnnouncementBar, Header (transparent → solid), MegaMenu, mobile menu, Footer, Concierge button; responsive & keyboard accessible |
| 1.6 | Admin shell | P0 | Sidebar, top bar, ⌘K command palette, DataTable, KpiCard, FormSection, EmptyState, light/dark |
| 1.7 | Internal style guide page | P0 | `/admin/style-guide` (staff-only) rendering every component/state, used for Playwright visual snapshots |
| 1.8 | System pages | P0 | Premium 404, error boundary, global error, maintenance mode page |

## Module 2: Catalog

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 2.1 | Categories admin | P0 | CRUD tree with reorder, image, SEO fields; slug rules; cache invalidation |
| 2.2 | Product + variants admin | P0 | Create/edit product, options (Size/Color/Fit), auto-generate variant matrix, per-variant SKU/price/compare-at/barcode/weight; draft/active/archived; autosave draft |
| 2.3 | Media management | P0 | Cloudinary upload (drag-drop, multi), reorder, alt text required, link images to color, dominant color/blur stored |
| 2.4 | Size charts | P0 | CRUD size charts, assign to products, model info |
| 2.5 | Collections admin | P0 | Manual (drag order) and automatic (rules) collections, hero media, SEO, schedule publish |
| 2.6 | Product relations | P1 | Curate "Complete the look", similar, upsell |
| 2.7 | Slug redirects | P0 | Slug change on published entity auto-creates 301; middleware resolves `redirects` table |
| 2.8 | Bulk import/export | P1 | CSV import (validated, dry-run preview, error report) and export of products/variants |
| 2.9 | Product listing page (PLP) | P0 | `/shop/[[...category]]` and `/collections/[slug]` per DESIGN §4.3; filters (size, color, fit, fabric, price, in-stock) in URL; sort; grid density; load-more + crawlable pagination; skeletons |
| 2.10 | Product card | P0 | 4:5 image, hover second image, color swatches switch image, badges, quick-add sizes (desktop), wishlist toggle |
| 2.11 | Product detail page (PDP) | P0 | Per DESIGN §4.4: gallery (zoom/lightbox/swipe), sticky buy box, swatches, size selector with stock states, size-guide drawer, accordions, sticky mobile bar, add-to-bag → cart drawer |
| 2.12 | Live price/stock island | P0 | PDP/PLP static shell + dynamic stock/price component; revalidate on stock change |
| 2.13 | Recently viewed | P1 | Client-side (localStorage) rail on PDP and cart |
| 2.14 | Product SEO | P0 | `generateMetadata`, canonical, Product/Offer/Breadcrumb JSON-LD, OG image per product |

## Module 3: Inventory and Purchasing

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 3.1 | Stock levels and ledger | P0 | `inventory_levels` + append-only `stock_movements`; all stock changes go through `inventoryService` only; CHECK constraints |
| 3.2 | Manual adjustments | P0 | Admin adjust with reason (count, damage, found); audit logged |
| 3.3 | Atomic reserve/commit/release | P0 | Concurrency-safe decrement (integration test: 50 parallel buys of 10 units → exactly 10 succeed); reservation TTL + release cron |
| 3.4 | Suppliers | P0 | CRUD suppliers |
| 3.5 | Purchase orders | P0 | Create PO with variant lines and unit cost; statuses; PDF export |
| 3.6 | Landed costs | P0 | Add freight/duty/other to PO; allocate by quantity or value |
| 3.7 | Goods receipt + weighted avg cost | P0 | Receive full/partial; creates receipt movements; recalculates `avg_cost_minor` (unit-tested formula) |
| 3.8 | Low-stock alerts | P1 | Threshold per variant; daily digest + dashboard widget; `stock.low` event |
| 3.9 | Inventory valuation and aging | P1 | Report: on-hand × avg cost by product/category; aging buckets (0–30/31–90/90+ days) |
| 3.10 | Multi-location and transfers | P2 | Transfers between locations with in/out movements |

## Module 4: Cart and Checkout

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 4.1 | Cart service | P0 | Guest cookie cart + user cart; add/update/remove; merge on login; stock-aware quantity limits; server-recomputed totals |
| 4.2 | Cart drawer and page | P0 | Per DESIGN §4.5 with free-shipping progress, undo remove, save for later |
| 4.3 | Address model (BD hierarchy) | P0 | `geo_areas` seeded (divisions, districts, thanas); cascading pickers; saved addresses |
| 4.4 | Shipping zones and rates | P0 | Admin config of zones/rates/free-over threshold/ETA; quote at checkout |
| 4.5 | Checkout page | P0 | One-page, guest-first, phone-first, distraction-free layout per DESIGN §4.6; inline validation; state persists on refresh |
| 4.6 | Order placement transaction | P0 | Idempotent submit; single DB transaction: order + items (price & cost snapshot) + stock commit/reserve + discount redemption + outbox event; integration-tested |
| 4.7 | Order confirmation page | P0 | Per DESIGN §4.7 with "we will personally confirm your order" message and Placed → Verified → Shipped → Delivered timeline; account creation prompt; browser `OrderPlaced` event |
| 4.8 | Checkout abuse protection | P0 | Rate limit submit; per-phone order velocity limit; phone blocklist |

## Module 5: Payments

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 5.1 | Payment provider interface | P0 | `PaymentProvider` contract + registry; config per provider in settings |
| 5.2 | Cash on Delivery | P0 | COD method with zone eligibility and max-amount rule |
| 5.3 | SSLCommerz (cards, bKash, Nagad) | P0 | Hosted session, success/fail/cancel return, IPN webhook, server-side validation API check, amount match, idempotent processing; sandbox E2E |
| 5.4 | Payment fees capture | P0 | Fee computed/recorded on success → `order_cost_lines(gateway_fee)` |
| 5.5 | Refunds | P0 | Full/partial refund from admin (provider API or manual record), updates order payment status, finance |
| 5.6 | Failed/expired payment recovery | P0 | Reservation release after TTL; "retry payment" link; switch to COD option |
| 5.7 | Stripe (international) | P2 | Stripe Checkout adapter, multi-currency settlement to base |
| 5.8 | bKash direct (tokenized) | P2 | Optional direct integration if fees justify |

## Module 6: Orders, Fulfillment and Shipping

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 6.1 | Order state machine | P0 | Statuses per ARCHITECTURE §6 incl. `under_verification` / `on_hold`; **no transition to `confirmed` except through staff verification**; transitions validated in service; every transition writes `order_events` + outbox |
| 6.2 | Admin order list | P0 | Filter by status/payment/date/channel/phone/assignee, saved views, bulk print/book courier **for confirmed orders only** (no bulk confirm), CSV export |
| 6.3 | Admin order detail | P0 | Items, customer, timeline, notes, payments, shipments, verification history, cost & **profit breakdown** panel, actions |
| 6.4 | Order verification queue | P0 | Every order (all channels, all payment methods) lands in `/admin/orders/verification` per ARCHITECTURE §6.1 and DESIGN §4.11; oldest-first with age timer, risk score and flags; claim with 15-min lock; manager assign/reassign; only `orders.verify` holders can act (authz tests) |
| 6.5 | Manual order entry | P0 | Staff creates order for FB/Instagram/WhatsApp/phone customers with `channel`; same pricing/stock rules; enters verification queue (self-verify only if setting enabled) |
| 6.6 | Invoices and packing slips | P0 | Branded PDF invoice + packing slip; batch print |
| 6.7 | Courier interface + Pathao | P0 | `CourierProvider`; book consignment, store tracking & **courier cost**; status webhook/polling → shipment events |
| 6.8 | Steadfast courier | P0 | Same contract as 6.7 |
| 6.9 | Packaging cost application | P0 | Packaging profile cost added to `order_cost_lines` at fulfillment |
| 6.10 | COD remittance reconciliation | P1 | Import/enter courier remittance; match against delivered COD shipments; flag mismatches; record COD fees |
| 6.11 | RTO handling | P0 | Delivery-failed → returned to origin: restock, record RTO loss cost, flag phone |
| 6.12 | Returns and exchanges | P0 | Customer self-service request (window rules), admin approve/receive/inspect, restock or write-off, refund / store credit / exchange-for-size flow |
| 6.13 | Verification checklist and outcomes | P0 | Required checklist (genuine, items/size, address, payment, stock) gates **Confirm**; outcomes confirm / call back later / cancel with required reason; every attempt logged in `order_verification_attempts`; click-to-call + SMS/WhatsApp templates; `confirmed_by` recorded; cancel releases stock, auto-refunds paid orders, `fake_order` adds risk flag |
| 6.14 | Edit order during verification | P0 | Change size/colour/qty, add/remove items, fix address before confirming; server-side re-price and stock adjust; audit + timeline entry; customer notified of changed total |
| 6.15 | Verification SLA and escalation | P0 | Configurable working hours, SLA and attempt threshold (OD-11); overdue highlight + manager alert; "needs manager review" flag after N failed attempts; callback reminders at `next_attempt_at`; **no automatic cancellation**: system must never cancel an order (test asserts this) |

## Module 7: Customer Accounts

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 7.1 | Auth pages | P0 | Login, register, forgot/reset, verify; phone OTP login; premium styling; rate limited |
| 7.2 | Account dashboard | P0 | Overview, profile, preferences (sizes, marketing consent) |
| 7.3 | Order history and tracking | P0 | List + detail with timeline and courier tracking link; reorder |
| 7.4 | Address book | P0 | CRUD with default address |
| 7.5 | Wishlist | P0 | Guest (local) + account wishlist, merge on login, move to bag |
| 7.6 | Returns self-service | P0 | Start return/exchange from order detail (uses 6.12) |
| 7.7 | Store credit and gift card balance | P1 | View balance & history |
| 7.8 | Admin customer management | P0 | Customer list/search, detail (orders, LTV, notes, segment), block/unblock |
| 7.9 | Data export / account deletion | P1 | Customer can request export/deletion; admin workflow |

## Module 8: Content and Landing Experience

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 8.1 | Section-block page builder | P0 | `pages` + `page_sections` with Zod-validated props per block type; admin add/reorder/hide/schedule; live preview (draft mode) |
| 8.2 | Homepage sections | P0 | All DESIGN §4.2 blocks implemented, art-directed hero images/video, LCP-optimized |
| 8.3 | Navigation and announcements | P0 | Admin-managed main/footer menus with mega-menu images; announcement bar scheduling |
| 8.4 | Static and legal pages | P0 | About/Our Story, Shipping, Returns & Exchange, FAQ (FAQPage JSON-LD), Contact, Privacy, Terms, Size Guide hub |
| 8.5 | Lookbooks | P1 | Editorial lookbook pages with shoppable hotspots |
| 8.6 | Journal (blog) | P1 | Posts with markdown/MDX, tags, related products, Article JSON-LD, RSS |
| 8.7 | Newsletter signup | P0 | Footer/section form, double opt-in, consent stored |
| 8.8 | Cookie consent | P0 | Consent banner gating marketing pixels (Consent Mode v2) |

## Module 9: Search and Discovery

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 9.1 | Search index | P0 | `search_vector` generated column (title, category, tags, attributes weighted) + trigram; synonyms table |
| 9.2 | Search overlay | P0 | Instant results (debounced, streamed), popular searches, keyboard nav |
| 9.3 | Search results page | P0 | Same filters/sort as PLP; typo tolerance; no-results state; `noindex` |
| 9.4 | Facet counts | P1 | Counts per filter value, disabled zero-result options |
| 9.5 | Recommendations | P1 | "You may also like" (same category + attributes), "Frequently bought together" from order data |
| 9.6 | Search analytics | P2 | Log queries + zero-result queries in admin |

## Module 10: Promotions and Pricing

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 10.1 | Discount engine | P0 | Percentage, fixed, free-shipping; scope (order/product/collection/category); min subtotal/qty; dates; usage limits per code/customer; stacking rules; fully unit-tested allocation |
| 10.2 | Discount codes at checkout | P0 | Apply/remove, clear error messages, redemption recorded in-transaction |
| 10.3 | Automatic promotions | P1 | Auto-applied promos, free shipping threshold banner sync |
| 10.4 | Buy X Get Y | P2 | BXGY rules |
| 10.5 | Compare-at / sale display | P0 | Sale price display rules, "Sale" collection automation |
| 10.6 | Gift cards | P2 | Sell/issue gift cards, hashed codes, redeem at checkout |
| 10.7 | Store credit | P1 | Ledger; issue from returns/goodwill; redeem at checkout |

## Module 11: Finance and Cost Tracking

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 11.1 | Expense categories | P0 | Seeded categories (DATA-MODEL §9), admin CRUD |
| 11.2 | Expense entry | P0 | Create/edit expense with date, category, vendor, amount, method, receipt upload, optional campaign; list with filters; CSV export |
| 11.3 | Recurring expenses | P0 | Templates generate monthly/weekly expenses via cron; skip/edit instance |
| 11.4 | Marketing campaigns | P0 | Campaign CRUD with channel + UTM; link expenses; orders attributed by UTM |
| 11.5 | Order cost lines | P0 | All automatic costs (shipping, gateway, COD, packaging, returns, RTO) recorded; manual cost line add |
| 11.6 | Order profit breakdown | P0 | Per-order contribution margin panel (formula per ARCHITECTURE §7.2), unit-tested |
| 11.7 | Daily financial rollups | P0 | `daily_financial_summaries` recomputed on events + nightly safety job; idempotent |
| 11.8 | Profit & Loss report | P0 | P&L by day/week/month/custom, placed vs delivered recognition toggle, period comparison, CSV/PDF export |
| 11.9 | Product profitability | P0 | Per product/variant: units, net sales, COGS, margin %, return rate; sortable |
| 11.10 | Campaign ROAS and CAC | P1 | ROAS per campaign/channel, CAC, new vs returning revenue |
| 11.11 | Expense analytics | P1 | Breakdown by category over time, budget vs actual |
| 11.12 | Cash-flow view | P2 | Cash in (payments, COD remittances) vs cash out (expenses, POs) |
| 11.13 | Finance permissions | P0 | Finance pages limited to `owner`, `finance` (and `admin` read) |

## Module 12: Reviews and Social Proof

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 12.1 | Review submission | P1 | Rating, title, body, fit feedback, size purchased, photos; verified purchase from delivered orders |
| 12.2 | Moderation | P1 | Admin approve/reject/respond; spam rate limits |
| 12.3 | PDP review display | P1 | Summary, fit meter, photo-first list, filters; AggregateRating JSON-LD |
| 12.4 | Review request email | P1 | Sent N days after delivery |
| 12.5 | UGC / Instagram grid | P2 | Curated UGC section |

## Module 13: Notifications and Marketing Automation

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 13.1 | Email infrastructure | P0 | Resend + React Email branded templates; send log; preview route in dev |
| 13.2 | Transactional emails | P0 | Order received (awaiting verification), order verified & confirmed, order updated during verification, shipped, delivered, cancelled, refund, return updates, auth emails |
| 13.3 | SMS notifications | P0 | SMS adapter; order received / verified & confirmed / updated / shipped / cancelled SMS; verification SMS templates; OTP |
| 13.4 | Abandoned cart recovery | P1 | Detect abandoned carts with contact; 2-step email/SMS sequence; recovery attribution |
| 13.5 | Back-in-stock notifications | P1 | Subscribe on OOS size; notify on restock |
| 13.6 | Admin alerts | P1 | New order, low stock, failed webhook, payment mismatch alerts |
| 13.7 | Marketing pixels + CAPI | P0 | GA4 + Meta Pixel (consent-gated) + Meta CAPI & GA4 MP server events with dedup IDs (ViewContent, AddToCart, InitiateCheckout; **Purchase sent server-side at staff confirmation**; browser `OrderPlaced` at checkout) |

## Module 14: SEO and Performance Hardening

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 14.1 | Metadata framework | P0 | `lib/seo` builders; default + per-route metadata; titles `{Page} \| AUREN` |
| 14.2 | Structured data | P0 | Organization, WebSite+SearchAction, BreadcrumbList, Product, CollectionPage, Article, FAQPage, MerchantReturnPolicy, OfferShippingDetails; validated in tests |
| 14.3 | Sitemaps and robots | P0 | Sitemap index (products, categories/collections, content, images); robots rules per ARCHITECTURE §9 |
| 14.4 | Faceted navigation rules | P0 | Canonical/noindex logic for filter combos; whitelist config |
| 14.5 | Product feeds | P1 | Google Merchant + Meta catalog feeds, cached, validated |
| 14.6 | OG images | P0 | `next/og` templates for product, collection, article, default |
| 14.7 | Performance budgets | P0 | Lighthouse CI budgets (ARCHITECTURE §10) on Home/PLP/PDP/Checkout; pass on mobile |
| 14.8 | Image pipeline audit | P0 | All images sized, `sizes` correct, priority on LCP, placeholders, AVIF |

## Module 15: Admin Dashboard, Analytics and Settings

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 15.1 | Dashboard KPIs | P0 | Net sales, orders, AOV, net profit, gross margin %, awaiting verification (with overdue count), median time-to-verify, verification cancel rate, to-ship, low stock, RTO rate; date range compare |
| 15.2 | Sales analytics | P1 | Trends, by channel/category/product, new vs returning customers, conversion funnel |
| 15.3 | Store settings | P0 | Store info, contact, currency, tax config, policies, social links, feature flags |
| 15.4 | Staff management | P0 | Invite staff, assign role, deactivate; owner-only |
| 15.5 | Audit log viewer | P1 | Filter by actor/entity/date |
| 15.6 | System health page | P1 | Failed jobs, webhook failures, outbox backlog |
| 15.7 | Verification performance report | P1 | Per staff and per period: orders verified/cancelled, SLA %, median time-to-verify, attempts per order, cancel reasons breakdown |

## Module 16: Launch Readiness

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 16.1 | Security review | P0 | OWASP checklist, dependency audit, authz tests for every admin action, webhook signature tests, pen-test style review |
| 16.2 | Accessibility audit | P0 | axe clean on all templates; manual keyboard + screen reader pass on purchase flow |
| 16.3 | Load test | P0 | k6 test: 200 concurrent users browsing + 20 checkouts/min with p95 targets met |
| 16.4 | Backups and restore drill | P0 | PITR verified; nightly dump; documented restore performed |
| 16.5 | Runbooks | P0 | Payment failure, courier down, DB restore, rollback deploy |
| 16.6 | Production cutover | P0 | Domain + DNS + SSL, prod keys, Search Console + Merchant Center verified, analytics verified, monitoring alerts live, smoke test |
| 16.7 | Legal and compliance | P0 | Privacy, terms, returns policy reviewed; cookie consent; trade license / VAT info in footer as required |

## Module 17: Future / Scale (P2)

| ID | Sub-feature | Pri | Acceptance criteria |
|---|---|---|---|
| 17.1 | Bangla localization | P2 | next-intl, `/bn` routes, hreflang, translated content fields |
| 17.2 | Multi-currency display | P2 | Geo-based currency display; settlement in base |
| 17.3 | Loyalty program | P2 | Points earn/redeem, tiers |
| 17.4 | Pre-orders and limited drops | P2 | Drop countdown, waitlist, pre-order inventory |
| 17.5 | PWA enhancements | P2 | Installable, offline fallback page |
