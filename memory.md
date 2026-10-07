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
- Made Upstash Redis, Email providers, and Inngest background jobs optional in production boot guards.
- Fixed Prisma P1011 `self-signed certificate in certificate chain` error by configuring pg Pool with `rejectUnauthorized: false` and `uselibpqcompat=true` for remote Supabase connections.
- Resolved production admin sign-in failure caused by Better Auth `Invalid origin: https://aurenbd.vercel.app`:
  - Better Auth validates the browser `Origin` header on auth endpoints. In Vercel, `APP_URL` defaulted to `VERCEL_URL` (deployment-specific preview hash) or `localhost`, causing Better Auth to reject requests from `https://aurenbd.vercel.app` with `403 FORBIDDEN (INVALID_ORIGIN)`.
  - Configured `trustedOrigins` in `src/lib/auth.ts` (`https://aurenbd.vercel.app`, `https://*.vercel.app`, Vercel production & deployment URLs, and `BETTER_AUTH_TRUSTED_ORIGINS`).
  - Updated `src/lib/env/schema.ts` to prioritize `VERCEL_PROJECT_PRODUCTION_URL` over preview hashes when `APP_URL` is unset, and sync `NEXT_PUBLIC_APP_URL`.
  - Sanitized email input on the sign-in form (`src/components/admin/sign-in-form.tsx`) with `.trim().toLowerCase()`.

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
