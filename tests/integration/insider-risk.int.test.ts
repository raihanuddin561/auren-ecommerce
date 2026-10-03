import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { db } from '@/lib/db';
import { clearLoggedEmails, getLoggedEmails } from '@/lib/email';
import { handleSecurityAlert } from '@/modules/audit/queries';
import { toPermissionSet, type StaffContext } from '@/lib/permissions';
import { audit, scanAuditForAlerts } from '@/modules/audit/service';

import {
  decideApproval,
  requestApproval,
  requireApproval,
  thresholdFor,
} from '@/modules/approvals/service';
import { makeStaff } from '../factories';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  clearLoggedEmails();
});
afterAll(closeDatabase);

/** The in-process server drops the connection after some provoked errors; reconnect before reading. */
async function settle() {
  await db.$queryRaw`SELECT 1`.catch(() => undefined);
  await db.$queryRaw`SELECT 1`;
}

async function staffContext(role: 'support' | 'manager' | 'admin' | 'finance' | 'owner') {
  const { user, member } = await makeStaff({ role });
  const grants = await db.rolePermission.findMany({
    where: { role },
    select: { permission: true },
  });
  const context: StaffContext = {
    id: member.id,
    userId: user.id,
    role,
    name: user.name,
    email: user.email,
    permissions: toPermissionSet(grants.map((g) => g.permission)),
  };
  return context;
}

const refund = (subjectId: string, amountMinor: bigint) => ({
  kind: 'refund',
  subjectType: 'order',
  subjectId,
  amountMinor,
  currency: 'BDT',
});

describe('maker-checker approvals', () => {
  it('needs no approval below the threshold and a second person above it', async () => {
    const maker = await staffContext('support');
    expect(await thresholdFor(db, 'refund')).toBe(500_000n);

    const small = await db.$transaction((tx) =>
      requestApproval(tx, maker, refund('o-1', 499_999n)),
    );
    expect(small).toEqual({ required: false });
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-1', 499_999n))),
    ).resolves.toBeUndefined();

    const big = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-2', 500_000n)));
    expect(big).toMatchObject({ required: true, created: true });
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-2', 500_000n))),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
  });

  it('is idempotent while a request is open', async () => {
    const maker = await staffContext('support');
    const first = await db.$transaction((tx) =>
      requestApproval(tx, maker, refund('o-3', 900_000n)),
    );
    const second = await db.$transaction((tx) =>
      requestApproval(tx, maker, refund('o-3', 900_000n)),
    );
    expect(second).toMatchObject({ created: false });
    expect(await db.approvalRequest.count()).toBe(1);
    expect(first.required && first.request.id).toBe(second.required && second.request.id);
  });

  it('refuses the maker as the checker, in the service and in the database', async () => {
    const maker = await staffContext('manager'); // holds approvals.decide
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-4', 900_000n)));
    const id = made.required ? made.request.id : '';
    await expect(
      db.$transaction((tx) => decideApproval(tx, maker, { id, decision: 'approved' })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // even raw SQL cannot make the requester the decider
    await expect(
      db.$executeRawUnsafe(
        `UPDATE approval_requests SET status = 'approved', decided_by = requested_by, decided_at = now() WHERE id = '${id}'::uuid`,
      ),
    ).rejects.toThrow(/maker_checker|closed the connection/);
    // whatever the error text, nothing changed
    await settle();
    const row = await db.approvalRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'pending', decidedBy: null });
  });

  it('needs the approvals.decide permission', async () => {
    const maker = await staffContext('support');
    const outsider = await staffContext('finance');
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-5', 900_000n)));
    const id = made.required ? made.request.id : '';
    await expect(
      db.$transaction((tx) => decideApproval(tx, outsider, { id, decision: 'approved' })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a second person approve, covers only that amount, and is used up once', async () => {
    const maker = await staffContext('support');
    const checker = await staffContext('admin');
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-6', 800_000n)));
    const id = made.required ? made.request.id : '';

    const decided = await db.$transaction((tx) =>
      decideApproval(tx, checker, { id, decision: 'approved', note: 'verified with the customer' }),
    );
    expect(decided.status).toBe('approved');

    // a larger refund than approved is not covered
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-6', 900_000n))),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    // the approved amount is
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-6', 800_000n))),
    ).resolves.toBeUndefined();
    // and only once
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-6', 800_000n))),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
  });

  it('a rejected request unlocks nothing, and a decision is final', async () => {
    const maker = await staffContext('support');
    const checker = await staffContext('admin');
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-7', 800_000n)));
    const id = made.required ? made.request.id : '';
    await db.$transaction((tx) => decideApproval(tx, checker, { id, decision: 'rejected' }));
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-7', 800_000n))),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    await expect(
      db.$transaction((tx) => decideApproval(tx, checker, { id, decision: 'approved' })),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('writes audit rows and id-only events for every step', async () => {
    const maker = await staffContext('support');
    const checker = await staffContext('admin');
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-8', 800_000n)));
    const id = made.required ? made.request.id : '';
    await db.$transaction((tx) => decideApproval(tx, checker, { id, decision: 'approved' }));

    const actions = (await db.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map(
      (r) => r.action,
    );
    expect(actions).toEqual(expect.arrayContaining(['approval.request', 'approval.approve']));
    const events = await db.outboxEvent.findMany({ orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.type)).toEqual(['approval.requested', 'approval.decided']);
    for (const event of events) {
      expect(JSON.stringify(event.payload)).not.toMatch(/@|phone|name/i);
    }
  });

  it('does not let a request for a larger amount reuse a smaller open one', async () => {
    const maker = await staffContext('support');
    await db.$transaction((tx) => requestApproval(tx, maker, refund('o-10', 600_000n)));
    await expect(
      db.$transaction((tx) => requestApproval(tx, maker, refund('o-10', 900_000n))),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    // asking for the same or a smaller amount joins the open request
    const again = await db.$transaction((tx) =>
      requestApproval(tx, maker, refund('o-10', 550_000n)),
    );
    expect(again).toMatchObject({ required: true, created: false });
  });

  it('an approval in one currency does not cover another, and expires after seven days', async () => {
    const maker = await staffContext('support');
    const checker = await staffContext('admin');
    const made = await db.$transaction((tx) =>
      requestApproval(tx, maker, refund('o-11', 800_000n)),
    );
    const id = made.required ? made.request.id : '';
    await db.$transaction((tx) => decideApproval(tx, checker, { id, decision: 'approved' }));
    await expect(
      db.$transaction((tx) =>
        requireApproval(tx, { ...refund('o-11', 800_000n), currency: 'USD' }),
      ),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 8 * 86_400_000 });
    try {
      await expect(
        db.$transaction((tx) => requireApproval(tx, refund('o-11', 800_000n))),
      ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    } finally {
      vi.useRealTimers();
    }
    await expect(
      db.$transaction((tx) => requireApproval(tx, refund('o-11', 800_000n))),
    ).resolves.toBeUndefined();
  });

  it('caps the configurable threshold so maker-checker cannot be switched off', async () => {
    await db.storeSetting.create({
      data: { key: 'approvals.thresholds', value: { refund: '999999999999' } },
    });
    expect(await thresholdFor(db, 'refund')).toBe(5_000_000n);
  });

  it('honours thresholds configured in store settings and fails safe for unknown kinds', async () => {
    await db.storeSetting.create({
      data: { key: 'approvals.thresholds', value: { refund: '100000' } },
    });
    expect(await thresholdFor(db, 'refund')).toBe(100_000n);
    expect(await thresholdFor(db, 'unheard_of')).toBe(0n);
  });

  it('cannot be deleted or edited after the decision', async () => {
    const maker = await staffContext('support');
    const checker = await staffContext('admin');
    const made = await db.$transaction((tx) => requestApproval(tx, maker, refund('o-9', 800_000n)));
    const id = made.required ? made.request.id : '';
    await db.$transaction((tx) => decideApproval(tx, checker, { id, decision: 'approved' }));
    await expect(
      db.$executeRawUnsafe(
        `UPDATE approval_requests SET amount_minor = 1 WHERE id = '${id}'::uuid`,
      ),
    ).rejects.toThrow(/immutable|closed the connection/);
    await settle();
    expect((await db.approvalRequest.findUniqueOrThrow({ where: { id } })).amountMinor).toBe(
      800_000n,
    );
  });
});

describe('role permission edits leave an audit trail', () => {
  it('records inserts, updates and deletes whoever makes them', async () => {
    await db.rolePermission.create({ data: { role: 'support', permission: 'finance.read' } });
    await db.rolePermission.delete({
      where: { role_permission: { role: 'support', permission: 'finance.read' } },
    });
    const rows = await db.auditLog.findMany({
      where: { entityType: 'role_permission' },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual(['role_permission.insert', 'role_permission.delete']);
    expect(rows[0]?.entityId).toBe('support:finance.read');
    expect(rows[0]?.actorId).toBeNull();
  });
});

describe('audit alerts', () => {
  // Creating a staff member is itself audited by the database (and alerted on): let the scan
  // consume that first so each test counts only the alerts it provokes.
  const prime = () => scanAuditForAlerts(db, new Date(Date.now() + 60_000));

  it('raises one alert per risky audit row and none for ordinary work', async () => {
    const actor = await staffContext('manager');
    await prime();
    await db.$transaction(async (tx) => {
      await audit(tx, {
        actorId: actor.userId,
        action: 'order.refund',
        entity: 'order',
        entityId: 'o1',
      });
      await audit(tx, {
        actorId: actor.userId,
        action: 'customers.export',
        entity: 'export',
        entityId: 'e1',
      });
      await audit(tx, {
        actorId: actor.userId,
        action: 'product.update',
        entity: 'product',
        entityId: 'p1',
      });
    });
    const alerts = await scanAuditForAlerts(db, new Date(Date.now() + 60_000));
    expect(alerts.map((a) => a.rule).sort()).toEqual(['export', 'refund']);

    const all = await db.outboxEvent.findMany({ where: { type: 'security.alert' } });
    // (the first scan, in prime(), already reported the new staff member)
    const events = all.filter((e) => (e.payload as { rule: string }).rule !== 'role_change');
    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(JSON.stringify(event.payload)).not.toMatch(/@auren|name|phone/i);
    }
  });

  it('does not raise the same alert twice (cursor advances in the same transaction)', async () => {
    const actor = await staffContext('manager');
    await prime();
    await db.$transaction((tx) =>
      audit(tx, { actorId: actor.userId, action: 'order.refund', entity: 'order', entityId: 'o2' }),
    );
    const now = new Date(Date.now() + 1000);
    expect((await scanAuditForAlerts(db, now)).length).toBe(1);
    expect((await scanAuditForAlerts(db, new Date(now.getTime() + 60_000))).length).toBe(0);
    const refunds = (await db.outboxEvent.findMany({ where: { type: 'security.alert' } })).filter(
      (e) => (e.payload as { rule: string }).rule === 'refund',
    );
    expect(refunds).toHaveLength(1);
  });

  it('flags repeated wrong re-authentication and a role permission edit', async () => {
    const actor = await staffContext('finance');
    await prime();
    await db.$transaction(async (tx) => {
      for (let i = 0; i < 3; i++) {
        await audit(tx, {
          actorId: actor.userId,
          action: 'staff.step_up_failed',
          entity: 'staff_member',
          entityId: actor.id,
        });
      }
    });
    await db.rolePermission.create({ data: { role: 'support', permission: 'audit.read' } });
    try {
      // the database clock may differ slightly from this process: look a minute ahead
      const alerts = await scanAuditForAlerts(db, new Date(Date.now() + 60_000));
      expect(alerts.map((a) => a.rule).sort()).toEqual([
        'role_permission_edit',
        'step_up_failures',
      ]);
    } finally {
      // role_permissions is system data that survives resets: put it back
      await db.rolePermission.delete({
        where: { role_permission: { role: 'support', permission: 'audit.read' } },
      });
    }
  });

  it('catches wrong re-authentication spread across scans and alerts once per window', async () => {
    const actor = await staffContext('finance');
    await prime();
    const wrong = () =>
      db.$transaction((tx) =>
        audit(tx, {
          actorId: actor.userId,
          action: 'staff.step_up_failed',
          entity: 'staff_member',
          entityId: actor.id,
        }),
      );
    const base = Date.now();
    await wrong();
    await wrong();
    expect(await scanAuditForAlerts(db, new Date(base + 60_000))).toEqual([]);
    await wrong();
    const second = await scanAuditForAlerts(db, new Date(base + 5 * 60_000));
    expect(second.map((a) => a.rule)).toEqual(['step_up_failures']);
    // the same burst does not alert again on the next scan
    expect(await scanAuditForAlerts(db, new Date(base + 10 * 60_000))).toEqual([]);
  });

  it('summarises a flood in one digest instead of mailing each row', async () => {
    const actor = await staffContext('manager');
    await prime();
    await db.$transaction(async (tx) => {
      for (let i = 0; i < 30; i++) {
        await audit(tx, {
          actorId: actor.userId,
          action: 'order.refund',
          entity: 'order',
          entityId: 'o-' + i,
        });
      }
    });
    const alerts = await scanAuditForAlerts(db, new Date(Date.now() + 60_000));
    expect(alerts).toHaveLength(20);
    expect(alerts.at(-1)).toMatchObject({ rule: 'digest', count: 11 });
  });

  it('emails the owner a message with ids only', async () => {
    const owner = await staffContext('owner');
    const result = await handleSecurityAlert({
      outboxId: '0199f7aa-1b2c-7d3e-8f40-123456789abc',
      payload: {
        rule: 'refund',
        auditLogId: '0199f7aa-1b2c-7d3e-8f40-123456789abd',
        actorId: owner.userId,
      },
    });
    expect(result).toEqual({ notified: 1 });
    const [mail] = getLoggedEmails();
    expect(mail?.to).toBe(owner.email);
    expect(mail?.subject).toContain('A refund was issued');
    expect(mail?.text).toContain('Audit entry id');
    expect(mail?.text).not.toMatch(/customer|phone/i);
  });
});
