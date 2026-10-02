---
name: auren-testing
description: "AUREN's test strategy and conventions: Vitest unit tests, integration tests on real PostgreSQL, Playwright E2E with axe accessibility and visual snapshots, Lighthouse budgets, test data factories, and what each sub-feature must cover. Use when writing, fixing or running tests in this repo."
---

# AUREN Testing

## Pyramid and commands
| Layer | Tool | Location | Command |
|---|---|---|---|
| Unit | Vitest | `src/**/__tests__/*.test.ts` | `pnpm test` |
| Integration (real Postgres) | Vitest + test DB | `src/**/__tests__/*.int.test.ts`, `tests/integration/` | `pnpm test:integration` |
| E2E + a11y + visual | Playwright + `@axe-core/playwright` | `tests/e2e/*.spec.ts` | `pnpm test:e2e` |
| Performance | Lighthouse CI | `lighthouserc.json` | `pnpm lhci` (CI) |

## Integration database
- Preferred: **Testcontainers** Postgres (needs Docker); `pnpm test:integration` starts `postgres:16-alpine`, runs `prisma migrate deploy` and shares it across files.
- Fallback when Docker isn't available: `TEST_DATABASE_URL` pointing to a throwaway PostgreSQL or a Neon test branch (set `DB_POOL_MAX=1` for single-connection servers). Global setup runs `prisma migrate deploy` against it.
- Tests never touch the dev or prod database. Global setup refuses a URL whose database name or host does not contain `test`.
- Files call `resetDatabase()` (tests/integration/helpers.ts) in `beforeEach`; it truncates everything except migration-seeded data with triggers disabled for that transaction only. Ledger-trigger tests need separate `it` blocks, because the database error may drop the connection on some servers.

## Factories
`tests/factories/*.ts`: `makeProduct()`, `makeVariant()`, `makeOrder({ status })`, `makeStaff({ role })`, `makeCustomer()`. They take overrides, use the real repositories, and produce realistic menswear data (names, sizes S–XXL / 28–40, colours). No random flakiness: seed faker with a fixed value.

## What every sub-feature must cover
- **Unit:** pure rules (totals, discount allocation, state transitions, finance formulas, risk scoring), including edge cases (zero, max, rounding).
- **Integration:** happy path, validation failure, authorization failure (customer and wrong-role staff), plus every relevant `INV-*` from `auren-commerce-invariants`.
- **E2E (user-visible flows):** happy path + one key failure/validation path, run at mobile (375×812) and desktop (1440×900); axe scan with zero serious/critical violations; visual snapshot for new storefront templates.
- Test names describe behaviour: `confirms an order only when the checklist is complete`, never module numbers.

## Playwright conventions
- Use role/label selectors (`getByRole`, `getByLabel`); add `data-testid` only when there is no accessible handle.
- Auth fixtures: `customerPage`, `staffPage({ role })` via storage state created in global setup.
- Payment and courier providers are stubbed in E2E via the adapter registry (`PAYMENTS_MODE=fake`), with sandbox runs in a separate tagged suite (`@sandbox`).
- Prefer `expect(...).toBeVisible()` over waits. No `waitForTimeout`.

## Fix loop
Implement → run the layer tests → fix the **root cause** → rerun → when green, run the full `pnpm test && pnpm test:integration` before review. Record counts in `context/progress-tracker.md`.

## Layout in this repo
- Unit: `src/**/__tests__/*.test.ts`, `tests/unit`, `tests/lint` (boundary fixtures, admin guard structure tests). `pnpm test`, `pnpm test:coverage` (money utilities must stay at 100 %).
- Integration: `tests/integration/*.int.test.ts`, factories in `tests/factories`. `pnpm test:integration`.
- E2E: `tests/e2e`. `*.db.spec.ts` needs Postgres (`E2E_WITH_DB=1`); `*.local.spec.ts` never runs against a deployed preview (`E2E_BASE_URL`). `pnpm test:e2e` builds first; `pnpm test:e2e:run` skips the build. Accessibility: `expectNoAxeViolations(page)` from `tests/e2e/support/axe.ts`.
