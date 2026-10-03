import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isDomainError } from '../errors';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  STAFF_ROLES,
  assertPermission,
  hasPermission,
  toPermissionSet,
  type Permission,
  type StaffContext,
  type StaffRole,
} from '../permissions';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const staffWith = (role: StaffRole, permissions: Permission[] = []): StaffContext => ({
  id: 'st1',
  userId: 'u1',
  role,
  name: 'Test Staff',
  email: 'staff@auren.local',
  permissions: new Set(permissions),
});

describe('assertPermission', () => {
  it('allows a staff member who holds the permission', () => {
    expect(() =>
      assertPermission(staffWith('support', ['orders.read']), 'orders.read'),
    ).not.toThrow();
  });

  it('throws FORBIDDEN with a generic message when the permission is missing', () => {
    try {
      assertPermission(staffWith('support', ['orders.read']), 'finance.read');
      throw new Error('expected FORBIDDEN');
    } catch (error) {
      expect(isDomainError(error)).toBe(true);
      expect(error).toMatchObject({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
      expect(String((error as Error).cause)).toContain('finance.read');
    }
  });

  it('never locks the owner out, even with an empty grant table', () => {
    const owner = staffWith('owner');
    for (const permission of PERMISSIONS) expect(hasPermission(owner, permission)).toBe(true);
  });

  it('ignores permission strings it does not know', () => {
    const set = toPermissionSet(['orders.verify', 'legacy.removed']);
    expect([...set]).toEqual(['orders.verify']);
  });
});

describe('default role grants', () => {
  it('lets exactly owner, admin, manager, support and order_verifier verify orders', () => {
    const verifiers = STAFF_ROLES.filter((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].includes('orders.verify'),
    );
    expect(verifiers.sort()).toEqual(['admin', 'manager', 'order_verifier', 'owner', 'support']);
  });

  it('keeps fulfillment, finance and content roles away from order verification', () => {
    for (const role of ['fulfillment', 'finance', 'content_editor'] as const) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain('orders.verify');
    }
  });

  it('gives the dedicated order_verifier everything needed to verify, edit and cancel, and nothing financial', () => {
    const grants = DEFAULT_ROLE_PERMISSIONS.order_verifier;
    expect(grants).toEqual(
      expect.arrayContaining(['orders.read', 'orders.update', 'orders.verify', 'orders.cancel']),
    );
    expect(grants.some((p) => p.startsWith('finance.'))).toBe(false);
  });

  it('reserves staff management for the owner', () => {
    for (const role of STAFF_ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role].includes('staff.manage')).toBe(role === 'owner');
    }
  });

  it('only references permissions that exist', () => {
    for (const role of STAFF_ROLES) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

/** Every migration that seeds role_permissions. */
const seedSql = () => {
  const dir = path.join(process.cwd(), 'prisma/migrations');
  return readdirSync(dir)
    .filter((name) => /add_staff_access|add_insider_risk_controls/.test(name))
    .map((name) => readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'))
    .join('\n');
};

describe('role_permissions seed migration', () => {
  it('grants every permission to the owner in the seed', () => {
    const sql = seedSql();
    for (const permission of PERMISSIONS) {
      expect(sql).toContain(`('owner', '${permission}')`);
    }
  });

  it('matches the in-code defaults exactly (drift guard)', () => {
    const dir = path.join(process.cwd(), 'prisma/migrations');
    const sql = readdirSync(dir)
      .filter((name) => /add_staff_access|add_insider_risk_controls/.test(name))
      .map((name) => readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'))
      .join('\n');
    const seeded = [...sql.matchAll(/\('([a-z_]+)', '([a-z_.]+)'\)/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    const expected = STAFF_ROLES.flatMap((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].map((permission) => `${role}:${permission}`),
    );
    expect(seeded.sort()).toEqual(expected.sort());
  });
});
