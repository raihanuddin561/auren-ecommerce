import { describe, expect, it } from 'vitest';
import {
  MAX_ALERTS_PER_SCAN,
  VOLUME_RULES,
  capAlerts,
  evaluateAlerts,
  type Alert,
  type AuditRowLite,
} from '../alerts';

const t0 = Date.parse('2026-10-03T10:00:00Z');
let counter = 0;
const row = (action: string, actorId: string | null, minutes = 0): AuditRowLite => ({
  id: `row-${++counter}`,
  actorId,
  action,
  createdAt: new Date(t0 + minutes * 60_000),
});

describe('single-row alert rules', () => {
  it.each([
    ['order.refund', 'refund'],
    ['refund.issue', 'refund'],
    ['customers.export', 'export'],
    ['export.orders', 'export'],
    ['staff.role_changed', 'role_change'],
    ['staff.deactivated', 'role_change'],
    ['role_permission.insert', 'role_permission_edit'],
    ['role_permission.delete', 'role_permission_edit'],
    ['staff_member.update', 'role_change'],
    ['staff_member.insert', 'role_change'],
    ['settings.update', 'settings_change'],
    ['approvals.thresholds.update', 'settings_change'],
    ['payment.refund', 'refund'],
    ['customers.export_requested', 'export'],
  ])('%s raises %s', (action, rule) => {
    const [alert] = evaluateAlerts([row(action, 'actor-1')]);
    expect(alert).toMatchObject({ rule, actorId: 'actor-1' });
    expect(alert?.auditLogId).toMatch(/^row-/);
  });

  it.each([
    'product.update',
    'order.confirm',
    'staff.step_up',
    'approval.request',
    'catalog.settings_view',
  ])('ordinary action %s raises nothing', (action) =>
    expect(evaluateAlerts([row(action, 'actor-1')])).toEqual([]),
  );

  it('leaves the actor out for system rows such as a database-level permission edit', () => {
    const [alert] = evaluateAlerts([row('role_permission.insert', null)]);
    expect(alert).toMatchObject({ rule: 'role_permission_edit' });
    expect(alert).not.toHaveProperty('actorId');
  });
});

describe('volume rules', () => {
  const { threshold: stepUp } = VOLUME_RULES.step_up_failures;
  const { threshold: verify } = VOLUME_RULES.verification_volume;

  it('flags repeated wrong re-authentication by one person inside the window', () => {
    const rows = Array.from({ length: stepUp }, (_, i) => row('staff.step_up_failed', 'a', i));
    expect(evaluateAlerts(rows)).toEqual([
      { rule: 'step_up_failures', actorId: 'a', count: stepUp, windowMinutes: 10 },
    ]);
  });

  it('does not flag the same count spread over a long time or across people', () => {
    const slow = Array.from({ length: stepUp }, (_, i) => row('staff.step_up_failed', 'a', i * 30));
    expect(evaluateAlerts(slow)).toEqual([]);
    const many = Array.from({ length: stepUp }, (_, i) => row('staff.step_up_failed', `p${i}`, i));
    expect(evaluateAlerts(many)).toEqual([]);
  });

  it('flags unusual verification volume by one person and ignores a normal day', () => {
    const busy = Array.from({ length: verify }, (_, i) => row('order.verify', 'v1', i));
    expect(evaluateAlerts(busy)).toEqual([
      { rule: 'verification_volume', actorId: 'v1', count: verify, windowMinutes: 60 },
    ]);
    const normal = Array.from({ length: verify - 1 }, (_, i) => row('order.confirm', 'v2', i));
    expect(evaluateAlerts(normal)).toEqual([]);
  });

  it('uses the densest window, not the total', () => {
    const rows = [
      ...Array.from({ length: stepUp - 1 }, (_, i) => row('staff.step_up_failed', 'a', i)),
      ...Array.from({ length: stepUp - 1 }, (_, i) => row('staff.step_up_failed', 'a', 300 + i)),
    ];
    expect(evaluateAlerts(rows)).toEqual([]);
  });
});

describe('flood control', () => {
  it('keeps small batches as they are', () => {
    const alerts: Alert[] = [{ rule: 'refund' }, { rule: 'export' }];
    expect(capAlerts(alerts)).toEqual(alerts);
  });

  it('turns a flood into the first alerts plus one digest with the remainder', () => {
    const flood: Alert[] = Array.from({ length: 35 }, () => ({ rule: 'refund' }));
    const capped = capAlerts(flood);
    expect(capped).toHaveLength(MAX_ALERTS_PER_SCAN);
    expect(capped.at(-1)).toEqual({ rule: 'digest', count: 35 - (MAX_ALERTS_PER_SCAN - 1) });
  });
});
