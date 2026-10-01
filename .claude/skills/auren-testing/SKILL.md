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
- Preferred: **Testcontainers** Postgres (needs Docker).
- Fallback when Docker isn't available: `TEST_DATABASE_URL` pointing to a local PostgreSQL or a Neon test branch. The global setup creates a schema per Vitest worker (`test_w<id>`), runs `prisma migrate deploy` into it, and drops it at the end.
- Tests never touch the dev or prod database. Global setup refuses to run if the URL host or name doesn't contain `test` or isn't a container.
- Each test runs inside a transaction that rolls back, or truncates the touched tables in `afterEach`.

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
