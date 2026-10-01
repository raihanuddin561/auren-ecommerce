---
name: auren-commerce-invariants
description: "The business invariants AUREN must never violate (money, stock, orders, staff verification, payments, finance, authz, audit, idempotency), each with the test that proves it. Use when implementing or reviewing anything touching cart, checkout, orders, payments, inventory, purchasing, returns, promotions or finance, and as the checklist for the commerce-invariants-reviewer agent."
---

# AUREN Commerce Invariants

Each invariant has an ID. A PR that touches the area must keep the listed proof test green, or add it if missing. Reviewers cite IDs in findings (e.g. "violates INV-S2").

## Money (M)
| ID | Invariant | Proof |
|---|---|---|
| INV-M1 | Money is integer minor units (`bigint` in DB, `bigint`/branded `Money` type in TS). No `number` floats for amounts, no `parseFloat` on money | Lint rule / grep in review; `lib/money` unit tests |
| INV-M2 | All arithmetic, rounding and allocation go through `lib/money.ts` | Unit tests incl. allocation sums == total |
| INV-M3 | Order totals are recomputed server-side from DB prices; client-sent prices/totals are ignored | Integration test: tampered payload → server total wins |
| INV-M4 | `total = subtotal − discount + shipping (+ tax if exclusive)`; line discounts sum to order discount | Property test on checkout totals |

## Stock (S)
| ID | Invariant | Proof |
|---|---|---|
| INV-S1 | `0 ≤ reserved ≤ on_hand` always (DB CHECK) | Migration + integration test |
| INV-S2 | No overselling under concurrency: atomic conditional update, zero rows → `OUT_OF_STOCK` | Integration test: 50 parallel buys of 10 units → exactly 10 succeed |
| INV-S3 | Every stock change writes exactly one `stock_movements` row; ledger sum == on_hand | Integration test reconciles ledger vs level |
| INV-S4 | Only `inventoryService` mutates `inventory_levels` | Boundary lint + review |
| INV-S5 | Cancelled/expired orders release exactly what they held | Integration test |

## Orders and verification (O)
| ID | Invariant | Proof |
|---|---|---|
| INV-O1 | **No order becomes `confirmed` without an authorized staff action** (`orders.verify`) with a completed checklist. No auto-confirm path for any payment method or channel. No bulk confirm | Integration + authz tests; grep for status writes |
| INV-O2 | **The system never cancels an order automatically.** Only a staff action (with reason) sets `cancelled`. (Abandoned online payment → `payment_expired`, never a placed order) | Test: jobs/cron never set `cancelled` |
| INV-O3 | Status changes only through the state machine guard; invalid transitions throw `INVALID_TRANSITION` | Unit tests over the transition table |
| INV-O4 | Every transition writes an `order_events` row and an outbox event in the same transaction | Integration test |
| INV-O5 | Order items snapshot title, SKU, options, **unit price and unit cost** at placement; catalog edits never change past orders | Integration test |
| INV-O6 | Order submit is idempotent (same idempotency key → same order, no duplicate) | Integration test |
| INV-O7 | Edits during verification re-price server-side, adjust stock, write audit + timeline | Integration test |

## Payments (P)
| ID | Invariant | Proof |
|---|---|---|
| INV-P1 | Paid status only after server-side verification with the provider API; amount and currency must match the order | Adapter tests with mocked provider |
| INV-P2 | Webhooks are signature/IPN-validated and deduplicated by `(provider, event_id)` | Integration test: replay → no double effect |
| INV-P3 | Refund total ≤ paid total; cancelling a paid order creates a refund record | Integration test |
| INV-P4 | No card data touches our servers (hosted pages only) | Review |

## Finance (F)
| ID | Invariant | Proof |
|---|---|---|
| INV-F1 | Profit numbers are derived from source records (order items, cost lines, expenses), never typed totals | Review |
| INV-F2 | Formulas match ARCHITECTURE §7.2 exactly | Unit tests with worked examples |
| INV-F3 | Weighted average cost formula on receipt; landed costs fully allocated (sum of allocations == landed total) | Unit tests |
| INV-F4 | Daily rollups are idempotent: recomputing a date twice gives identical rows | Integration test |
| INV-F5 | Revenue recognition default = delivered date; toggle = placed date | Unit test |

## Security and audit (A)
| ID | Invariant | Proof |
|---|---|---|
| INV-A1 | Every Server Action / route handler validates with Zod and checks authn/authz server-side | Authz test per admin action (customer + wrong-role staff → FORBIDDEN) |
| INV-A2 | Every admin mutation writes an `audit_logs` row with before/after | Integration test |
| INV-A3 | Customers can only read their own orders, addresses and wishlist (IDOR-safe queries scoped by user id) | Integration test |
| INV-A4 | Rate limits on login, OTP, register, checkout submit, coupon apply, review submit | Test using limiter stub |
| INV-A5 | Secrets never reach client bundles (`server-only` on lib/db, auth, integrations) | Build check |

## Side effects (E)
| ID | Invariant | Proof |
|---|---|---|
| INV-E1 | No email/SMS/HTTP calls inside DB transactions; use outbox → Inngest | Review |
| INV-E2 | Event handlers are idempotent (re-delivery is safe) | Test: handler run twice → one effect |
