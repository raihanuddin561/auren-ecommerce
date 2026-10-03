/**
 * Audit-log alert rules (insider risk). Pure functions over audit rows so they can be tested
 * without a database; the scheduled scan in service.ts feeds them rows and turns the results into
 * `security.alert` events that carry ids and counts only (INV-A9).
 */

export interface AuditRowLite {
  id: string;
  actorId: string | null;
  action: string;
  createdAt: Date;
}

export type AlertRuleId =
  | 'refund'
  | 'export'
  | 'role_change'
  | 'role_permission_edit'
  | 'settings_change'
  | 'step_up_failures'
  | 'verification_volume'
  | 'digest';

export interface Alert {
  rule: AlertRuleId;
  /** The audit row to look at (single-row rules) */
  auditLogId?: string;
  actorId?: string;
  count?: number;
  windowMinutes?: number;
}

/** One alert per matching row. */
const SINGLE_ROW_RULES: ReadonlyArray<{
  rule: AlertRuleId;
  matches: (action: string) => boolean;
}> = [
  { rule: 'refund', matches: (a) => /(^|\.)refund(\.|$)|^order\.refund/.test(a) },
  { rule: 'export', matches: (a) => /(^export\.|\.export(_|$))/.test(a) },
  {
    rule: 'role_change',
    // staff_member.* rows are written by a database trigger, so they appear even for raw SQL
    matches: (a) =>
      /^staff\.(role_changed|invited|deactivated|reactivated)/.test(a) ||
      /^staff_member\.(insert|update|delete)$/.test(a),
  },
  { rule: 'role_permission_edit', matches: (a) => a.startsWith('role_permission.') },
  {
    rule: 'settings_change',
    matches: (a) => a.startsWith('settings.') || a.startsWith('approvals.thresholds'),
  },
];

/** Thresholds for the volume rules; deliberately conservative defaults, tune from real traffic. */
export const VOLUME_RULES = {
  step_up_failures: {
    actions: ['staff.step_up_failed', 'staff.step_up_blocked'],
    windowMinutes: 10,
    threshold: 3,
  },
  verification_volume: {
    actions: ['order.verify', 'order.confirm'],
    windowMinutes: 60,
    threshold: 40,
  },
} as const;

export type VolumeRuleId = keyof typeof VOLUME_RULES;

export const VOLUME_ACTIONS: readonly string[] = Object.values(VOLUME_RULES).flatMap(
  (rule) => rule.actions,
);
export const LONGEST_VOLUME_WINDOW_MINUTES = Math.max(
  ...Object.values(VOLUME_RULES).map((rule) => rule.windowMinutes),
);

export function evaluateSingleRowAlerts(rows: readonly AuditRowLite[]): Alert[] {
  const alerts: Alert[] = [];
  for (const row of rows) {
    for (const { rule, matches } of SINGLE_ROW_RULES) {
      if (matches(row.action)) {
        alerts.push({ rule, auditLogId: row.id, ...(row.actorId ? { actorId: row.actorId } : {}) });
        break;
      }
    }
  }
  return alerts;
}

/** The densest burst per person: the most events inside any window of the rule's length. */
export function evaluateVolumeAlerts(rows: readonly AuditRowLite[]): Alert[] {
  const alerts: Alert[] = [];
  for (const [rule, config] of Object.entries(VOLUME_RULES) as Array<
    [VolumeRuleId, (typeof VOLUME_RULES)[VolumeRuleId]]
  >) {
    const windowMs = config.windowMinutes * 60_000;
    const byActor = new Map<string, number[]>();
    for (const row of rows) {
      if (!row.actorId || !(config.actions as readonly string[]).includes(row.action)) continue;
      const times = byActor.get(row.actorId) ?? [];
      times.push(row.createdAt.getTime());
      byActor.set(row.actorId, times);
    }
    for (const [actorId, times] of byActor) {
      times.sort((a, b) => a - b);
      let best = 0;
      let start = 0;
      for (let end = 0; end < times.length; end++) {
        while (times[end]! - times[start]! > windowMs) start += 1;
        best = Math.max(best, end - start + 1);
      }
      if (best >= config.threshold) {
        alerts.push({ rule, actorId, count: best, windowMinutes: config.windowMinutes });
      }
    }
  }
  return alerts;
}

/** Both kinds at once, for callers that already hold all the rows they care about. */
export const evaluateAlerts = (rows: readonly AuditRowLite[]): Alert[] => [
  ...evaluateSingleRowAlerts(rows),
  ...evaluateVolumeAlerts(rows),
];

/** At most this many alerts leave one scan individually; the rest are summarised in one digest. */
export const MAX_ALERTS_PER_SCAN = 20;

export function capAlerts(alerts: Alert[]): Alert[] {
  if (alerts.length <= MAX_ALERTS_PER_SCAN) return alerts;
  const kept = alerts.slice(0, MAX_ALERTS_PER_SCAN - 1);
  return [...kept, { rule: 'digest', count: alerts.length - kept.length }];
}

export const ALERT_TITLES: Record<AlertRuleId, string> = {
  refund: 'A refund was issued',
  export: 'Data was exported',
  role_change: 'A staff role or account changed',
  role_permission_edit: 'Role permissions were edited',
  settings_change: 'A security-relevant setting changed',
  step_up_failures: 'Repeated wrong re-authentication attempts',
  verification_volume: 'Unusually many order verifications by one person',
  digest: 'More security alerts than can be listed',
};
