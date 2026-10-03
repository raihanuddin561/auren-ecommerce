import { afterAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { closeDatabase } from './helpers';

/**
 * Supabase exposes the public schema through a Data API with the roles anon and authenticated.
 * AUREN never uses it, so the database must refuse it even if it is switched on: Row Level
 * Security on every public table with no policy for those roles, and no privileges for them.
 * On a plain PostgreSQL (CI, local development) those roles do not exist: the role checks then
 * run against roles created inside a rolled-back transaction.
 */
afterAll(closeDatabase);

const API_ROLES = ['anon', 'authenticated', 'service_role'] as const;

describe('Row Level Security on the public schema', () => {
  it('is enabled on every table (a new table needs auren_secure_table in its migration)', async () => {
    const rows = await db.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
       ORDER BY 1`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('has exactly one policy per table, and it is for auren_app only', async () => {
    const policies = await db.$queryRaw<
      Array<{ tablename: string; policyname: string; roles: string[] }>
    >`SELECT tablename, policyname, roles::text[] AS roles FROM pg_policies WHERE schemaname = 'public'`;
    for (const policy of policies) {
      expect(policy.policyname, policy.tablename).toBe('auren_app_full');
      expect(policy.roles, policy.tablename).toEqual(['auren_app']);
    }
    const tables = await db.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`;
    expect(policies.length).toBe(Number(tables[0]?.n));
  });

  it('lets the application role work as before, and shows other roles nothing', async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE auren_app');
      const rows = await tx.$queryRaw<
        Array<{ n: bigint }>
      >`SELECT count(*)::bigint AS n FROM users`;
      expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(0);
    });
    // A role with table privileges but no policy sees no rows at all.
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE ROLE zz_rls_probe NOLOGIN`);
        // PostgreSQL 16+: the creator of a role may not SET ROLE to it unless it grants itself that.
        const [who] = await tx.$queryRaw<
          Array<{ me: string; version: number }>
        >`SELECT current_user::text AS me, current_setting('server_version_num')::int AS version`;
        if (who && who.version >= 160000) {
          await tx.$executeRawUnsafe(
            `GRANT zz_rls_probe TO "${who.me.replaceAll('"', '')}" WITH SET TRUE`,
          );
        }
        await tx.$executeRawUnsafe(`GRANT SELECT ON users TO zz_rls_probe`);
        await tx.$executeRawUnsafe(
          `INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
           VALUES (gen_random_uuid(), 'x', 'rls-probe@auren.test', true, now(), now())`,
        );
        await tx.$executeRawUnsafe('SET LOCAL ROLE zz_rls_probe');
        const rows = await tx.$queryRaw<
          Array<{ n: bigint }>
        >`SELECT count(*)::bigint AS n FROM users`;
        throw new Error(`visible:${rows[0]?.n}`);
      }),
    ).rejects.toThrow(/visible:0/);
  });
});

describe('the Data API roles hold no privileges', () => {
  it('anon, authenticated and service_role (when they exist) hold no explicit access to the public schema', async () => {
    const existing = await db.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname = ANY(${[...API_ROLES]})`;
    for (const { rolname } of existing) {
      const rows = await db.$queryRawUnsafe<Array<{ what: string }>>(
        `SELECT 'table ' || c.relname AS what
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S', 'v')
            AND (has_any_column_privilege('${rolname}', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
                 OR has_table_privilege('${rolname}', c.oid, 'DELETE,TRUNCATE,TRIGGER,SELECT,INSERT,UPDATE'))
          UNION ALL
         SELECT 'schema public' WHERE EXISTS (
            SELECT 1 FROM pg_namespace n
              CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
             WHERE n.nspname = 'public' AND a.grantee = '${rolname}'::regrole)`,
      );
      expect(rows, `${rolname} must have no access to public`).toEqual([]);
    }
  });

  it('auren_lock_data_api() removes grants the platform made, for existing and future tables', async () => {
    await expect(
      db.$transaction(async (tx) => {
        for (const role of API_ROLES) {
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
          );
          await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
          await tx.$executeRawUnsafe(`GRANT SELECT, INSERT ON users TO ${role}`);
        }
        await tx.$executeRawUnsafe('SELECT public.auren_lock_data_api()');
        const left = await tx.$queryRaw<Array<{ role: string }>>`
          SELECT r AS role FROM unnest(${[...API_ROLES]}::text[]) AS r
           WHERE has_table_privilege(r, 'public.users', 'SELECT,INSERT')
              OR EXISTS (
                SELECT 1 FROM pg_namespace n
                  CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                 WHERE n.nspname = 'public' AND a.grantee = r::regrole)`;
        throw new Error(`left:${left.map((l) => l.role).join(',')}`);
      }),
    ).rejects.toThrow(/left:$/);
  });

  it('helper makes a new table safe in one call', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('CREATE TABLE zz_new_table (id int)');
        await tx.$executeRawUnsafe(`SELECT public.auren_secure_table('zz_new_table'::regclass)`);
        const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
          SELECT relrowsecurity AS ok FROM pg_class WHERE relname = 'zz_new_table'`;
        throw new Error(`rls:${rows[0]?.ok}`);
      }),
    ).rejects.toThrow(/rls:true/);
  });

  it('a function created later is not callable by PUBLIC either (default privileges)', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'CREATE FUNCTION public.zz_future_fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$',
        );
        const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
          SELECT has_function_privilege('public', 'public.zz_future_fn()', 'EXECUTE') AS ok`;
        throw new Error(`public-execute:${rows[0]?.ok}`);
      }),
    ).rejects.toThrow(/public-execute:false/);
  });

  it('our own functions are not callable by PUBLIC (and so not by the API roles)', async () => {
    const rows = await db.$queryRaw<Array<{ proname: string }>>`
      SELECT p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
         AND (p.proacl IS NULL
              OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                          WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))`;
    expect(rows.map((r) => r.proname)).toEqual([]);
  });
});
