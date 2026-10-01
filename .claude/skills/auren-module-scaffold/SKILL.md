---
name: auren-module-scaffold
description: "Create or extend an AUREN domain module (src/modules/<name>) with the standard file layout, layer responsibilities and test locations. Use when a sub-feature needs a new module, or new capabilities in an existing one (catalog, inventory, purchasing, cart, checkout, orders, payments, shipping, returns, customers, promotions, reviews, content, search, finance, notifications, analytics, audit, settings)."
---

# AUREN Module Scaffold

Before creating anything, check whether `src/modules/<name>/` already exists. If it does, extend those files and don't duplicate them.

## Layout

```
src/modules/<name>/
├─ schemas.ts      # Zod input schemas (+ inferred input types). Shared by forms & actions
├─ types.ts        # Domain types / DTOs returned to UI (never raw Prisma models with secrets)
├─ errors.ts       # (optional) module-specific DomainError codes
├─ repository.ts   # Prisma access only. Functions take (tx: Tx, ...). No business rules
├─ service.ts      # Business rules, transactions, state machines, cross-module calls, audit, outbox
├─ actions.ts      # 'use server' Server Actions: parse → authn/authz → service → updateTag → ActionResult
├─ queries.ts      # Cached/uncached reads for Server Components ('use cache' + cacheTag where public)
├─ events.ts       # Event type constants + payload Zod schemas this module emits
├─ handlers.ts     # (optional) Inngest functions consuming events (idempotent)
├─ index.ts        # Public surface for OTHER modules: re-export service fns + types only
└─ __tests__/
   ├─ service.test.ts          # unit (pure rules, mocked repo)
   └─ service.int.test.ts      # integration (real Postgres)
```

UI lives outside the module: `src/components/storefront/<area>/`, `src/components/admin/<area>/`, routes in `src/app/...`.

## Steps
1. Read the sub-feature row in `context/feature-list.md` and the module row in ARCHITECTURE §5.
2. Schema change needed? Follow `auren-db-change` first.
3. Create files from the layout above, **only those needed now**. Don't add empty placeholders.
4. Register cross-module access through `index.ts`. Other modules import `@/modules/<name>` and never deep paths.
5. Add permissions to the seed (`role_permissions`) for new admin capabilities, named `<module>.<verb>` (e.g. `orders.verify`, `finance.read`).
6. New events: add to `events.ts`, add a row to ARCHITECTURE §3.2 if it's a new event type, and write the handler in the consumer module.
7. Write tests next to the code (unit + integration); E2E goes in `tests/e2e/<area>.spec.ts` with descriptive names.
8. Follow `auren-nextjs-patterns` for action, query and caching code and `auren-commerce-invariants` for rules.

## Naming
- Files and folders kebab-case; React components PascalCase; functions camelCase verbs (`confirmOrder`, `listPendingVerification`).
- Never put module numbers in names, routes, test titles or UI copy.
