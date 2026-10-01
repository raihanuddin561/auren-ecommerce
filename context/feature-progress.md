# AUREN — Feature Progress

> One row per sub-feature from [feature-list.md](./feature-list.md). Update the row **immediately** when a stage completes.
> **Stage values:** `Todo` · `WIP` · `Done` · `N/A` · `Blocked`. **Overall** is `Done` only when every applicable stage is `Done`.
> **Notes:** put `HOLD` here to skip a sub-feature; record new-vs-enhancement classification, PR links and blockers.
>
> Stages: **BE** = backend/service + DB · **API** = actions/route handlers + validation + authz · **UT** = unit/integration tests · **FE** = UI · **E2E** = Playwright + axe · **CR** = code review gate


## Module 0: Foundation and Platform

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | Project scaffold | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | create-next-app refuses non-empty dir: scaffold in temp folder, then move in |
| 0.2 | Code quality tooling | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.3 | Environment config | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.4 | Local infrastructure | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | Decision: Docker Desktop (owner, 2026-10-01). Owner installs Docker Desktop + WSL2 before this item |
| 0.5 | Database + Prisma baseline | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.6 | Money and core utilities | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.7 | Authentication core | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.8 | Staff RBAC | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.9 | Outbox + background jobs | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.10 | Audit log | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.11 | Testing harness | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.12 | CI pipeline | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.13 | Observability | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.14 | Security headers + rate limiting | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 0.15 | Seed data | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

## Module 1: Design System and Brand UI

| ID | Sub-feature | Pri | BE | API | UT | FE | E2E | CR | Overall | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Design tokens | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.2 | Fonts and base styles | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.3 | UI primitives | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.4 | Motion utilities | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.5 | Storefront shell | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.6 | Admin shell | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.7 | Internal style guide page | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |
| 1.8 | System pages | P0 | Todo | Todo | Todo | Todo | Todo | Todo | Todo | |

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
| R1 Foundation | 0, 1 | 23 | 0 |
| R2 Sellable MVP | 2, 3, 4, 5, 6, 7 | 64 | 0 |
| R3 Premium launch | 8, 9, 11, 14, 16 | 42 | 0 |
| R4 Growth | 10, 12, 13, 15 | 26 | 0 |
| R5 Scale | 17 | 5 | 0 |

> Releases group modules by when they're needed. P1/P2 items inside R2/R3 modules may ship after launch.
