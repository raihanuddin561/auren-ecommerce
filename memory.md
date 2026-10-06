# Memory — Order Flow (Cart, Checkout, Verification) and Platform Hardening

Last updated: 2026-10-06 21:59 UTC+6

## What was built

- Modules completed & verified: `shipping`, `cart`, `checkout`, `orders`, `payments`, `notifications`, `settings`.
- Migration: `add_cart_checkout_orders` applied to dev & test DBs (orders, order_items, order_events, carts, geo_areas, shipping_zones, customer_risk_flags, append-only triggers, RLS).
- Storefront flows: `/cart` drawer & page, `/checkout` multi-step form with Bangladesh geo hierarchy, `/track/[token]` order tracking and confirmation timeline.
- Admin consoles: `/admin/orders` (list & detail), `/admin/settings/shipping` (shipping zones editor), Order Verification panel with `orders.verify` gate.
- Vercel/Supabase builds hardened: Supabase connection fallbacks (`POSTGRES_PRISMA_URL`), auto-TLS support, resilient static sitemap generation when DB is unavailable during build.

## Decisions made

- Mandatory staff order verification (ADR-015): All orders require human verification with `orders.verify` permission before moving to `confirmed` status; no auto-confirm or bulk confirm path.
- Layering invariants: `app/` → `modules/<x>/{actions,queries}` → `service` → `repository` → Prisma (no Prisma outside repository).
- Money representation: Handled exclusively via `src/lib/money.ts` in BigInt minor units. No floating point math.
- Shipping hierarchy: 8 divisions, 64 districts, ~355 thanas supported with weight and zone quoting.

## Problems solved

- Resolved build issues on Vercel: ensured `prisma generate` executes during build and sitemap gracefully handles build-time DB absence.
- Repaired COD registry lookup and phone normalization for Bangladesh numbers.
- Fixed form-scoped locators and empty-bag state in Playwright checkout spec.

## Current state

- Full unit test suite passes: 88 files, 1,136 tests green.
- TypeScript typecheck (`pnpm typecheck`): Clean, 0 errors.
- ESLint (`pnpm lint`) and Prettier (`pnpm format:check`): Clean.
- Secrets scan (`pnpm secrets:scan`): Clean.
- Integration tests: Cart (14/14), Checkout (30/30) pass on local PostgreSQL.

## Next session starts with

- Execute E2E checkout suite with Playwright (`tests/e2e/checkout.db.spec.ts`).
- Begin Module 6 (Fulfillment & Shipping: couriers Pathao & Steadfast, packing slips, invoices, returns/RTO).

## Open questions

- None blocking. Courier API credentials for Pathao/Steadfast sandbox will be needed when testing live integration in Module 6.
