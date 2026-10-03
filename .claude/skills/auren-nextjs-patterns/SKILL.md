---
name: auren-nextjs-patterns
description: "AUREN's concrete Next.js (16+, App Router, Cache Components) coding patterns: layering, Server Action template, ActionResult contract, caching and tag invalidation, route handlers/webhooks, metadata. Use whenever writing or reviewing any code under src/app, src/modules, src/lib in this repo. Complements the generic `nextjs-best-practices` skill, which predates Cache Components; where they differ, THIS skill wins."
---

# AUREN Next.js Patterns

Read `docs/architecture/ARCHITECTURE.md` §3–§5 for the why. This skill is the how.

> Next.js APIs move fast. Before using a caching/routing API, check the docs for the **installed** version (`pnpm why next`, then nextjs.org/docs). If an API below differs in the installed version, follow the docs and update this skill in the same PR.

## 1. Layering (enforced by eslint-plugin-boundaries)

```
app/**              → modules/*/actions | modules/*/queries | components | lib
modules/x/actions   → modules/x/schemas, modules/x/service, lib
modules/x/queries   → modules/x/service | modules/x/repository (read-only), lib
modules/x/service   → modules/x/repository, OTHER modules' service (public fns only), lib, integrations
modules/x/repository→ lib/db only
integrations/**     → lib only
components/**       → components, lib (no modules/*/service, no db)
```
Forbidden: `@/lib/db` from `app/`, `components/` and `actions`; importing another module's repository; client components importing anything from `modules/` except types and actions. `@/lib/db` is allowed in repositories, in services (to open `db.$transaction`) and in queries (to pass `db` to a repository). Enforced by `eslint.boundaries.mjs`, proven by `tests/lint/boundaries.test.ts`.

## 2. Server Action template

```ts
// src/modules/orders/actions.ts
'use server';

import { updateTag } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { assertPermission } from '@/lib/permissions';
import { toActionError, type ActionResult } from '@/lib/action-result';
import { confirmOrderSchema } from './schemas';
import * as orderService from './service';

export async function confirmOrder(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  const parsed = confirmOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'VALIDATION', fieldErrors: parsed.error.flatten().fieldErrors } };

  const staff = await requireStaff();                 // throws → redirect to login
  await assertPermission(staff, 'orders.verify');     // throws FORBIDDEN

  try {
    const order = await orderService.confirm({ ...parsed.data, actorId: staff.id }); // audit + outbox inside
    updateTag(`order:${order.id}`);
    return { ok: true, data: { orderId: order.id } };
  } catch (err) {
    return toActionError(err);                        // DomainError → typed code; unknown → logged + generic
  }
}
```

Rules:
- Input is `unknown` and is parsed with Zod. Never trust client types.
- Authenticate, then authorize, before any read of private data.
- Business logic lives in the **service**, not the action.
- Return `ActionResult<T>`: `{ ok: true, data } | { ok: false, error: { code, message?, fieldErrors? } }`. Throw only for auth redirects.
- Domain errors: `class DomainError extends Error { code: 'OUT_OF_STOCK' | 'INVALID_TRANSITION' | ... }` in `lib/errors.ts`.

## 3. Services and transactions

```ts
// src/modules/orders/service.ts
import { db, type Tx } from '@/lib/db';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';

export async function confirm({ orderId, checklist, actorId }: ConfirmInput) {
  return db.$transaction(async (tx) => {
    const order = await repo.lockById(tx, orderId);          // SELECT ... FOR UPDATE
    assertTransition(order.status, 'confirmed');              // state machine guard
    assertChecklistComplete(checklist);
    const updated = await repo.markConfirmed(tx, orderId, actorId);
    await audit(tx, { actorId, action: 'order.confirm', entity: 'order', entityId: orderId, before: order, after: updated });
    await enqueueEvent(tx, { type: 'order.confirmed', aggregateId: orderId, payload: { orderId } });
    return updated;
  });
}
```
- Repository functions take `tx: Tx` (`PrismaClient | Prisma.TransactionClient`) as their first argument.
- Cross-module writes in one transaction call the other module's tx-aware service function (e.g. `inventoryService.commit(tx, lines)`).
- Side effects (email/SMS/HTTP) are **never** done inside the transaction. Use `enqueueEvent` and an Inngest handler.

## 4. Caching (Cache Components)

`next.config.ts`: `cacheComponents: true`.

```ts
// src/modules/catalog/queries.ts
import { cacheLife, cacheTag } from 'next/cache';

export async function getProductBySlug(slug: string) {
  'use cache';
  cacheLife('hours');
  const product = await catalogRepo.findPublishedBySlug(db, slug);
  if (product) cacheTag(`product:${product.id}`, 'products');
  return product;
}
```

Tag vocabulary (keep in sync with ARCHITECTURE §3.3):
| Tag | Invalidated by |
|---|---|
| `product:<id>`, `products` | product/variant/media/price save, publish/unpublish |
| `stock:<variantId>` | any inventory movement (dynamic island reads uncached anyway) |
| `collection:<id>`, `collections` | collection save, membership job |
| `category:<id>`, `categories` | category save |
| `content:<pageSlug>`, `nav`, `announcements` | CMS publish |
| `sitemap`, `feeds` | any publish |

- In Server Actions use `updateTag(tag)` (read-your-own-writes).
- In route handlers, webhooks and Inngest jobs use `revalidateTag(tag, 'max')`.
- Never cache anything user-specific (cart, account, admin, checkout). Those read cookies, which keeps them dynamic. Wrap them in `<Suspense>` with a skeleton.
- PDP/PLP price and stock badges are small dynamic components inside `<Suspense>`; the rest of the page is cached.

## 5. Route handlers and webhooks

```ts
// src/app/api/webhooks/[provider]/route.ts
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();                       // raw body for signature checks
  const adapter = getPaymentProvider(provider);       // 404 if unknown
  const event = await adapter.verifyAndParse(raw, req.headers);   // throws → 400
  const inserted = await webhookRepo.insertIfNew(db, provider, event.id, event); // UNIQUE guard
  if (!inserted) return Response.json({ ok: true, duplicate: true });
  await paymentService.handleProviderEvent(event);    // idempotent
  return Response.json({ ok: true });
}
```
Always verify with the provider's validation API before marking anything paid. The amount must equal `orders.total_minor`.

## 6. Pages and metadata

- Pages are Server Components. Fetch via `queries.ts`, never `fetch('/api/...')` to our own API.
- `params` and `searchParams` are Promises: `const { slug } = await params`.
- Every public route exports `generateMetadata` built with `lib/seo` helpers (title template `%s | AUREN`, canonical, OG). Add JSON-LD via `<JsonLd data={productJsonLd(p)} />`.
- `notFound()` for missing or unpublished entities; check the `redirects` table first (proxy handles it).
- Every route segment with data gets `loading.tsx` (skeleton) and, where useful, `error.tsx`.
- Admin, account, checkout and cart set `robots: { index: false }`.

## 7. Client components
Only for interactivity (gallery, drawers, size selector, forms). Keep them small, accept serializable props, call Server Actions, and show optimistic UI with `useOptimistic` / `useActionState`. Use `motion/react` with `LazyMotion` + `domAnimation` to keep bundles small.

## 8. Request-boundary proxy
`src/proxy.ts` (Next 16 name for middleware; use `middleware.ts` if the installed version requires it): admin session gate (cheap cookie check; real authz in layout and actions), `redirects` table lookup (cached), security headers / CSP nonce.

## 9. Verified against the installed versions (Next 16.3.8, Prisma 7.10, Better Auth 1.7.6, Zod 4, Vitest 5)

- `connection()` (`next/server`) keeps a route handler dynamic; without it a handler with no request APIs can be prerendered at build time (see `/api/health`).
- With Cache Components, anything that reads cookies or headers (sessions, `requireStaff()`) must sit under `<Suspense>`; a layout that gates access renders an async shell component inside Suspense, and each page still calls `requireStaff()` itself (`tests/lint/admin-guards.test.ts` enforces this).
- CSP has two regimes (ADR-022): the prerendered storefront keeps a static header from `next.config.ts`; `/admin`, `/checkout`, `/account` and `/api` get a per-request nonce from `proxy.ts`. A layout in a nonce section must be rendered per request: `await connection()` at the top of the section's root layout and `export const instant = false`, and inline scripts there read `(await headers()).get('x-nonce')`. Never import `node:*` modules into anything a client component reaches (the env schema is client-safe for that reason).
- Prisma 7: `prisma.config.ts` holds the datasource URL and seed command; the client is generated to `src/generated/prisma` (import from `@/generated/prisma/client`) and needs the `@prisma/adapter-pg` driver adapter; `uuid(7)` is supported; `prisma migrate diff --from-schema <old> --to-schema <new> --script` produces migration SQL without a database.
- CLI scripts that import `server-only` code run with `tsx --import ./scripts/stub-server-only.mjs`.
- Better Auth: credential accounts must have `account_id = user id`; `withSentryConfig` comes from `@sentry/nextjs/config`; social login never links to existing accounts and never applies to staff (ADR-017).
- pnpm 12 blocks dependency build scripts until allowed in `pnpm-workspace.yaml` (`allowBuilds`) and rejects packages published less than a day ago (`minimumReleaseAge`).
- Zod 4: `z.email()`, `z.url()`, `error.issues`; `.flatten()` still works but prefer `validationError(error)` from `lib/action-result`.
