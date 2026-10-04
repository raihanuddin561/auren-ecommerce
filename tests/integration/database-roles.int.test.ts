import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, inject } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createDbClient, db } from '@/lib/db';
import { runIdempotent } from '@/lib/idempotency';
import { runOnce } from '@/lib/inbox';
import { dispatchPendingEvents, enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import { closeDatabase, resetDatabase } from './helpers';

/**
 * The runtime role `auren_app` must not be able to rewrite history, change the schema or switch
 * safety triggers off, even if application code or an injected statement tries.
 *
 * Two proofs:
 *  1. `asApp` runs statements inside a transaction after `SET LOCAL ROLE auren_app`, so PostgreSQL
 *     applies exactly that role's privileges. It works wherever the test user is a superuser (the
 *     Testcontainers server, or the in-process PGlite server used when Docker is unavailable).
 *  2. When the harness owns a real server (Testcontainers) it gives `auren_app` a login and
 *     connects as that role, the way the deployed application does (`real login` block). CI must
 *     provide this proof; locally it is skipped when Docker is not available.
 */
beforeAll(async () => {
  // Fail loudly, with the cause, if the test user cannot become auren_app (assertions below would
  // otherwise "pass" on a permission error about SET ROLE itself).
  await expect(asApp((tx) => currentUser(tx))).resolves.toBe('auren_app');
});
beforeEach(resetDatabase);
afterAll(closeDatabase);

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function currentUser(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ u: string }>>`SELECT current_user AS u`;
  return rows[0]?.u ?? '';
}

async function asApp<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE auren_app');
    return fn(tx);
  });
}

const attempt = (statement: string) =>
  asApp((tx) => tx.$executeRawUnsafe(statement)).then(
    () => null,
    (error: unknown) => String(error),
  );

const denied = async (statement: string): Promise<string> => {
  const message = await attempt(statement);
  if (message === null) throw new Error(`expected "${statement}" to be denied, but it succeeded`);
  return message;
};

const PRIVILEGE =
  /permission denied for (table|schema|sequence|function) |must be owner of|permission denied to /i;

/**
 * A client that really is auren_app: a real login when the harness owns the server, otherwise the
 * shared single connection switched with SET ROLE (only valid with a pool of one connection).
 */
async function withAppClient<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const appUrl = inject('appDatabaseUrl');
  if (appUrl) {
    const client = createDbClient(appUrl);
    try {
      return await fn(client);
    } finally {
      await client.$disconnect();
    }
  }
  if (process.env.DB_POOL_MAX !== '1') {
    throw new Error('Run with DB_POOL_MAX=1 (single shared connection) or provide a real login.');
  }
  await db.$executeRawUnsafe('SET ROLE auren_app');
  try {
    return await fn(db);
  } finally {
    await db.$executeRawUnsafe('RESET ROLE');
  }
}

async function seedLedgerRows() {
  const auditId = await db.$transaction((tx) =>
    audit(tx, { actorId: null, action: 'setting.update', entity: 'setting', entityId: 'x' }),
  );
  const outboxId = await db.$transaction((tx) =>
    enqueueEvent(tx, {
      type: 'system.sample',
      aggregateType: 'sample',
      aggregateId: 'x',
      payload: { message: 'roles' },
    }),
  );
  return { auditId, outboxId };
}

describe('role definition', () => {
  it('exists with no elevated attributes', async () => {
    const rows = await db.$queryRaw<
      Array<{
        rolname: string;
        rolsuper: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolbypassrls: boolean;
      }>
    >`SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
        FROM pg_roles WHERE rolname IN ('auren_app', 'auren_migrator') ORDER BY rolname`;
    expect(rows.map((r) => r.rolname)).toEqual(['auren_app', 'auren_migrator']);
    // The local PostgreSQL setup (scripts/local-db-setup.sql) gives the migrator CREATEROLE so it
    // can set role defaults and the tests can create probe roles; the container and CI do not.
    const localMigrator = Boolean(process.env.TEST_DATABASE_URL);
    for (const row of rows) {
      expect(row.rolcreaterole).toBe(localMigrator && row.rolname === 'auren_migrator');
      expect(row).toMatchObject({
        rolsuper: false,
        rolcreatedb: false,
        rolbypassrls: false,
      });
    }
  });

  it('owns nothing: no relation, function, type, schema or database belongs to auren_app', async () => {
    const [counts] = await db.$queryRaw<Array<Record<string, bigint>>>`
      SELECT
        (SELECT count(*) FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'auren_app') AS relations,
        (SELECT count(*) FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE r.rolname = 'auren_app') AS functions,
        (SELECT count(*) FROM pg_type t JOIN pg_roles r ON r.oid = t.typowner WHERE r.rolname = 'auren_app') AS types,
        (SELECT count(*) FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner WHERE r.rolname = 'auren_app') AS schemas,
        (SELECT count(*) FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE r.rolname = 'auren_app') AS databases`;
    expect(
      Object.fromEntries(Object.entries(counts ?? {}).map(([k, v]) => [k, Number(v)])),
    ).toEqual({
      relations: 0,
      functions: 0,
      types: 0,
      schemas: 0,
      databases: 0,
    });
  });

  it('holds no TRUNCATE, TRIGGER or REFERENCES privilege on any public table', async () => {
    const rows = await db.$queryRaw<Array<{ tablename: string; priv: string }>>`
      SELECT t.tablename, p.priv
        FROM pg_tables t
        CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) AS p(priv)
       WHERE t.schemaname = 'public'
         AND has_table_privilege('auren_app', format('public.%I', t.tablename), p.priv)`;
    expect(rows).toEqual([]);
  });

  it('reads and writes every ordinary table, and only those on the exception list are restricted', async () => {
    const rows = await db.$queryRaw<
      Array<{ tablename: string; sel: boolean; ins: boolean; upd: boolean; del: boolean }>
    >`SELECT t.tablename,
             has_table_privilege('auren_app', format('public.%I', t.tablename), 'SELECT') AS sel,
             has_table_privilege('auren_app', format('public.%I', t.tablename), 'INSERT') AS ins,
             has_any_column_privilege('auren_app', format('public.%I', t.tablename), 'UPDATE') AS upd,
             has_table_privilege('auren_app', format('public.%I', t.tablename), 'DELETE') AS del
        FROM pg_tables t WHERE t.schemaname = 'public' ORDER BY 1`;
    // Tables the application intentionally cannot fully write. Adding a table here needs a reason.
    const restricted: Record<string, Partial<Record<'sel' | 'ins' | 'upd' | 'del', boolean>>> = {
      _prisma_migrations: { sel: false, ins: false, upd: false, del: false },
      audit_logs: { sel: true, ins: true, upd: false, del: false },
      stock_movements: { sel: true, ins: true, upd: false, del: false },
      processed_events: { sel: true, ins: true, upd: false, del: false },
      // A delivery that happened is never edited: corrections are new movements.
      goods_receipts: { sel: true, ins: true, upd: false, del: false },
      goods_receipt_items: { sel: true, ins: true, upd: false, del: false },
      // Column level UPDATE (delivery bookkeeping only) is checked in its own test.
      outbox_events: { sel: true, ins: true, upd: true, del: false },
      role_permissions: { sel: true, ins: false, upd: false, del: false },
      // A decision is an UPDATE of a pending row (guarded by a trigger); rows are never deleted.
      approval_requests: { sel: true, ins: true, upd: true, del: false },
    };
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      const expected = restricted[row.tablename] ?? { sel: true, ins: true, upd: true, del: true };
      expect(
        { sel: row.sel, ins: row.ins, upd: row.upd, del: row.del },
        `privileges of ${row.tablename}`,
      ).toEqual(expected);
    }
  });

  it('cannot read migration bookkeeping or change role permissions', async () => {
    expect(await denied('SELECT * FROM "_prisma_migrations" LIMIT 1')).toMatch(
      /permission denied for table _prisma_migrations/,
    );
    expect(
      await denied(
        `INSERT INTO "role_permissions" ("role", "permission") VALUES ('support', 'x.y')`,
      ),
    ).toMatch(/permission denied for table role_permissions/);
    expect(await denied('DELETE FROM "role_permissions"')).toMatch(
      /permission denied for table role_permissions/,
    );
  });
});

describe('append-only ledgers', () => {
  it('cannot update, delete or truncate audit rows (privilege, not only trigger)', async () => {
    await seedLedgerRows();
    expect(await denied(`UPDATE "audit_logs" SET "action" = 'x.y'`)).toMatch(PRIVILEGE);
    expect(await denied('DELETE FROM "audit_logs"')).toMatch(PRIVILEGE);
    expect(await denied('TRUNCATE TABLE "audit_logs"')).toMatch(PRIVILEGE);
    expect(await denied('TRUNCATE TABLE "stock_movements"')).toMatch(PRIVILEGE);
    expect(await denied('DELETE FROM "stock_movements"')).toMatch(PRIVILEGE);
    expect(await denied(`DELETE FROM "processed_events"`)).toMatch(PRIVILEGE);
    expect(await denied(`UPDATE "processed_events" SET "consumer" = 'x'`)).toMatch(PRIVILEGE);
  });

  it('can still append audit rows and outbox events and read them back', async () => {
    const ids = await asApp(async (tx) => {
      const auditId = await audit(tx, {
        actorId: null,
        action: 'setting.update',
        entity: 'setting',
        entityId: 'as-app',
      });
      const outboxId = await enqueueEvent(tx, {
        type: 'system.sample',
        aggregateType: 'sample',
        aggregateId: 'as-app',
        payload: { message: 'roles' },
      });
      return { auditId, outboxId };
    });
    expect(ids.auditId).toBeTruthy();
    expect(ids.outboxId).toBeTruthy();
  });

  it('may change only the delivery columns of an outbox row, and never delete one', async () => {
    const { outboxId } = await seedLedgerRows();
    await asApp(
      (tx) =>
        tx.$executeRaw`UPDATE "outbox_events" SET "attempts" = "attempts" + 1, "last_error" = 'x'
                      WHERE "id" = ${outboxId}::uuid`,
    );
    expect(await denied(`UPDATE "outbox_events" SET "payload" = '{}'::jsonb`)).toMatch(PRIVILEGE);
    expect(await denied(`UPDATE "outbox_events" SET "type" = 'tampered'`)).toMatch(PRIVILEGE);
    expect(await denied('DELETE FROM "outbox_events"')).toMatch(PRIVILEGE);
    expect(await denied('TRUNCATE TABLE "outbox_events"')).toMatch(PRIVILEGE);
  });

  it('grants UPDATE on exactly the six delivery columns of the outbox and nothing else', async () => {
    const rows = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'outbox_events'
         AND has_column_privilege('auren_app', 'public.outbox_events', column_name, 'UPDATE')
       ORDER BY column_name`;
    expect(rows.map((r) => r.column_name)).toEqual([
      'attempts',
      'available_at',
      'dispatched_at',
      'last_error',
      'locked_until',
      'status',
    ]);
  });

  it('cannot replay history: a dispatched outbox event can never go back to pending', async () => {
    const { outboxId } = await seedLedgerRows();
    await db.$executeRaw`UPDATE "outbox_events" SET "status" = 'dispatched', "dispatched_at" = now()
                          WHERE "id" = ${outboxId}::uuid`;
    expect(await denied(`UPDATE "outbox_events" SET "status" = 'pending'`)).toMatch(
      /dispatched outbox event cannot be changed/,
    );
    expect(
      await denied(`UPDATE "outbox_events" SET "dispatched_at" = now() - interval '1 day'`),
    ).toMatch(/dispatched outbox event cannot be changed/);
  });

  it('every table guarded by the append-only trigger rejects UPDATE and DELETE for auren_app', async () => {
    const guarded = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT DISTINCT c.relname AS tablename
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE NOT t.tgisinternal AND p.proname = 'forbid_ledger_mutation'`;
    expect(guarded.length).toBeGreaterThanOrEqual(3);
    for (const { tablename } of guarded) {
      const [priv] = await db.$queryRawUnsafe<Array<{ upd: boolean; del: boolean }>>(
        `SELECT has_any_column_privilege('auren_app', 'public."${tablename}"', 'UPDATE') AS upd,
                has_table_privilege('auren_app', 'public."${tablename}"', 'DELETE') AS del`,
      );
      // outbox_events keeps column-level UPDATE for delivery bookkeeping only (checked above).
      if (!['outbox_events', 'approval_requests'].includes(tablename)) {
        expect(priv?.upd, `${tablename} UPDATE`).toBe(false);
      }
      expect(priv?.del, `${tablename} DELETE`).toBe(false);
    }
  });
});

describe('no schema changes and no way to switch safeguards off', () => {
  it.each([
    ['create a table', 'CREATE TABLE "zz_probe" ("id" int)'],
    ['alter a table', 'ALTER TABLE "audit_logs" ADD COLUMN "zz" int'],
    ['drop a table', 'DROP TABLE "audit_logs"'],
    ['disable a trigger', 'ALTER TABLE "audit_logs" DISABLE TRIGGER ALL'],
    ['drop a trigger', 'DROP TRIGGER "audit_logs_append_only_trg" ON "audit_logs"'],
    [
      'create a trigger',
      'CREATE TRIGGER zz BEFORE INSERT ON "users" FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()',
    ],
    [
      'replace the guard function',
      'CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql',
    ],
    ['bypass triggers through replication role', `SET session_replication_role = 'replica'`],
    ['create a schema', 'CREATE SCHEMA zz'],
    ['create a role', 'CREATE ROLE zz_role'],
    ['create a temporary table', 'CREATE TEMP TABLE "users" ("id" int)'],
  ])('refuses to %s', async (_label, statement) => {
    expect(await denied(statement)).toMatch(
      /permission denied|must be owner|must be superuser|not permitted/i,
    );
  });
});

describe('privilege escalation', () => {
  it('cannot grant itself more: PostgreSQL ignores a GRANT from a role without grant option', async () => {
    await asApp(async (tx) => {
      await tx.$executeRawUnsafe('GRANT UPDATE, DELETE, TRUNCATE ON "audit_logs" TO "auren_app"');
    });
    const [priv] = await db.$queryRaw<Array<{ upd: boolean; del: boolean; trunc: boolean }>>`
      SELECT has_table_privilege('auren_app', 'public.audit_logs', 'UPDATE') AS upd,
             has_table_privilege('auren_app', 'public.audit_logs', 'DELETE') AS del,
             has_table_privilege('auren_app', 'public.audit_logs', 'TRUNCATE') AS trunc`;
    expect(priv).toEqual({ upd: false, del: false, trunc: false });
  });
});

describe('future tables', () => {
  it('receive data privileges by default but never TRUNCATE', async () => {
    await db.$executeRawUnsafe('CREATE TABLE "zz_future_probe" ("id" int primary key)');
    try {
      const [priv] = await db.$queryRaw<Array<Record<string, boolean>>>`
        SELECT has_table_privilege('auren_app', 'public.zz_future_probe', 'SELECT') AS sel,
               has_table_privilege('auren_app', 'public.zz_future_probe', 'INSERT') AS ins,
               has_table_privilege('auren_app', 'public.zz_future_probe', 'UPDATE') AS upd,
               has_table_privilege('auren_app', 'public.zz_future_probe', 'DELETE') AS del,
               has_table_privilege('auren_app', 'public.zz_future_probe', 'TRUNCATE') AS trunc,
               has_table_privilege('auren_app', 'public.zz_future_probe', 'TRIGGER') AS trig`;
      expect(priv).toEqual({
        sel: true,
        ins: true,
        upd: true,
        del: true,
        trunc: false,
        trig: false,
      });
    } finally {
      await db.$executeRawUnsafe('DROP TABLE "zz_future_probe"');
    }
  });
});

describe('the real runtime code paths work as auren_app', () => {
  it('dispatches outbox events (lease, deliver, retry and give up)', async () => {
    const first = await db.$transaction((tx) =>
      enqueueEvent(tx, {
        type: 'system.sample',
        aggregateType: 'sample',
        aggregateId: 'ok',
        payload: { message: 'deliver me' },
      }),
    );
    const second = await db.$transaction((tx) =>
      enqueueEvent(tx, {
        type: 'system.sample',
        aggregateType: 'sample',
        aggregateId: 'bad',
        payload: { message: 'fail me' },
      }),
    );
    const sent: string[] = [];
    const summary = await withAppClient((client) =>
      dispatchPendingEvents(client, async (events) => {
        for (const event of events) {
          if (event.id === second) throw new Error('provider down');
          sent.push(event.id);
        }
      }),
    );
    expect(summary).toMatchObject({ leased: 2, dispatched: 1 });
    expect([...new Set(sent)]).toEqual([first]);
    const rows = await db.outboxEvent.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.status)).toEqual(['dispatched', 'pending']);
    expect(rows[1]?.lastError).toBe('provider down');
  });

  it('claims events once and replays idempotent requests', async () => {
    const results = await withAppClient(async (client) => {
      const a = await runOnce(client, 'roles-test', 'evt-1', async () => 'done');
      const b = await runOnce(client, 'roles-test', 'evt-1', async () => 'again');
      const options = {
        scope: 'roles-test',
        actor: 'tester',
        key: 'key-0001-abcd',
        request: { n: 1 },
      };
      const c = await runIdempotent(client, options, async () => ({ ok: true }));
      const d = await runIdempotent(client, options, async () => ({ ok: false }));
      return { a, b, c, d };
    });
    expect(results.a).toEqual({ executed: true, value: 'done' });
    expect(results.b).toEqual({ executed: false });
    expect(results.c).toEqual({ replayed: false, value: { ok: true } });
    expect(results.d).toEqual({ replayed: true, value: { ok: true } });
  });
});

const appUrl = inject('appDatabaseUrl');

it.runIf(process.env.CI === 'true')(
  'CI provides the real-login proof (a server the harness owns)',
  () => {
    expect(appUrl).toBeTruthy();
  },
);

describe.runIf(appUrl)('real login as auren_app (needs a server the harness owns)', () => {
  async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: appUrl as string });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  it('connects as auren_app, which is neither superuser nor owner', async () => {
    await withClient(async (client) => {
      const who = await client.query('SELECT current_user, session_user');
      expect(who.rows[0]).toEqual({ current_user: 'auren_app', session_user: 'auren_app' });
      const owner = await client.query(
        `SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'`,
      );
      expect(owner.rows[0]?.tableowner).not.toBe('auren_app');
      const settings = await client.query(`SHOW search_path`);
      expect(settings.rows[0]?.search_path).toBe('public, pg_catalog');
    });
  });

  it('cannot alter, delete or disable anything on the audit trail', async () => {
    await seedLedgerRows();
    await withClient(async (client) => {
      for (const statement of [
        `UPDATE audit_logs SET action = 'x.y'`,
        'DELETE FROM audit_logs',
        'TRUNCATE audit_logs',
        'ALTER TABLE audit_logs DISABLE TRIGGER ALL',
        `SET session_replication_role = 'replica'`,
        'DROP TABLE audit_logs',
        'SET ROLE auren_migrator',
      ]) {
        await expect(client.query(statement), statement).rejects.toThrow(
          /permission denied|must be owner|superuser/i,
        );
      }
    });
  });
});
