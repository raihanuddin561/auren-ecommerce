---
name: auren-db-change
description: "Safe workflow for any AUREN database change: Prisma schema edits, migrations, indexes, constraints, seed updates, TypedSQL reporting queries. Use whenever prisma/schema.prisma, prisma/migrations, prisma/sql or prisma/seed.ts must change."
---

# AUREN Database Change Workflow

Logical model: `docs/architecture/DATA-MODEL.md`. Physical model: `prisma/schema.prisma`. **They must agree at the end of the PR.**

## Conventions checklist
- [ ] Model names PascalCase singular, mapped to snake_case plural tables: `model OrderItem { ... @@map("order_items") }`; columns camelCase in Prisma with `@map("snake_case")`.
- [ ] `id String @id @default(uuid(7)) @db.Uuid` (supported by Prisma 7). For raw SQL inserts, fixtures and Better Auth use `newId()` from `lib/ids.ts`.
- [ ] `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`; `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)`.
- [ ] Money: `BigInt` + sibling `currency String @db.Char(3)` on the owning record. **Never `Decimal`/`Float` for money.**
- [ ] Enums for state machines (`OrderStatus`, `PaymentStatus`…) mapped to snake_case values with `@map`.
- [ ] Foreign keys have explicit `onDelete` (`Restrict` for financial/order data, `Cascade` only for pure children like `cart_items`).
- [ ] Indexes from DATA-MODEL.md "Key indexes" added (`@@index`, `@@unique`). Every FK used in a WHERE/JOIN is indexed.
- [ ] CHECK constraints, partial indexes, generated `tsvector` columns, GIN/trigram indexes: Prisma can't express them, so add them as **raw SQL appended to the generated migration** (`--create-only`, then edit).
- [ ] **Every migration that creates a table ends with `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;` followed by `SELECT public.auren_secure_table('<table>'::regclass);`** (the helper enables RLS and adds the single `auren_app` policy; production is Supabase, whose Data API exposes the public schema to `anon`/`authenticated`, ADR-025). `tests/integration/public-schema-security.int.test.ts` fails when a table lacks RLS or an API role holds a privilege.
- [ ] Ledger tables (`stock_movements`, `audit_logs`, `store_credit_ledger`, `outbox_events`, `order_verification_attempts`) are append-only: no update/delete functions in repositories.

## Steps
1. Update `DATA-MODEL.md` first if the logical model changes (and add an ADR if it changes a decision).
2. Edit `prisma/schema.prisma`.
3. With a database: `pnpm prisma migrate dev --create-only --name <verb_object>`. Without one: `pnpm prisma migrate diff --from-schema <previous schema file> --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<verb_object>/migration.sql`. Names are snake_case and descriptive, never module numbers.
4. Open the generated SQL; append raw SQL for CHECKs, partial or GIN indexes, generated columns, `CREATE EXTENSION IF NOT EXISTS pg_trgm/citext`.
5. `pnpm prisma migrate dev` to apply, then `pnpm prisma generate`.
6. **Destructive change?** (drop/rename column, type narrowing, NOT NULL on existing data) Use expand → migrate data → contract across separate migrations. Never edit a migration that has been applied to staging or prod.
7. Update `prisma/seed.ts` so `pnpm db:reset` yields a realistic dataset.
8. Reporting SQL goes in `prisma/sql/*.sql` (TypedSQL) and is called from the finance repository only.
9. Add or adjust integration tests (Testcontainers / test DB) for constraints that guard invariants (see `auren-commerce-invariants`).
10. Run `pnpm typecheck && pnpm test:integration`.

## Query rules
- Lock rows you will update in the same transaction: `SELECT ... FOR UPDATE` via `tx.$queryRaw` in the repository (e.g. order confirm, stock commit).
- Stock decrement is a single conditional `UPDATE ... WHERE on_hand - reserved >= $q RETURNING *`. Check the affected row count.
- Avoid N+1: use `include`/`select` deliberately; list pages select only displayed columns.
- Use pagination with keyset (`created_at, id`) for admin lists > 1k rows.
- `postgres-best-practices` skill applies for tuning; use `database-optimizer` agent for slow queries.

## Repo specifics
- Production database is Supabase Postgres (ADR-025): migrations use `DIRECT_URL` (direct or session connection, never the transaction pooler), the app uses the pooler on port 6543. Create the roles as the Supabase `postgres` user without superuser-only features (runbook section "Supabase").
- Roles: migrations run as `auren_migrator` (DIRECT_URL, owner); the app runs as `auren_app` (DATABASE_URL, DML only; see `docs/runbooks/database-roles.md`). New tables get DML for `auren_app` by default privileges, so **every new ledger migration must `REVOKE UPDATE, DELETE ON TABLE "<ledger>" FROM "auren_app"`** and attach the `forbid_ledger_mutation()` triggers; `tests/integration/database-roles.int.test.ts` fails otherwise. Anything the app must never edit (permission maps, config seeds) gets the same REVOKE.
- Shared append-only guard: `forbid_ledger_mutation()` (created in the outbox migration) backs triggers on `audit_logs`, `stock_movements` and the outbox. Reuse it for new ledgers (BEFORE UPDATE OR DELETE row trigger plus BEFORE TRUNCATE statement trigger).
- Credential accounts: `accounts.account_id` must equal the user id for `providerId = 'credential'`.
- Seeded system data (`role_permissions`) lives in a migration, guarded by `src/lib/__tests__/permissions.test.ts`; development data lives in `prisma/seed.ts` + `prisma/seed-data.ts`.
- Beware JavaScript `String.replace` with `$$` when generating SQL files: `$$` collapses to `$` and breaks plpgsql bodies. Use a replacer function.
