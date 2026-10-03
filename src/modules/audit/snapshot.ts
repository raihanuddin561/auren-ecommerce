import { createHash, createHmac } from 'node:crypto';
import { isPiiKey } from '@/lib/pii';
import { isSensitiveKey } from '@/lib/sensitive';

/**
 * Turns domain objects into the JSON stored in the audit trail: money and ids stay exact
 * (bigint becomes text), dates become ISO strings, secrets are removed, and oversized values are
 * cut so one careless call cannot bloat the table.
 */

const REDACTED = '[redacted]';

/**
 * Personal values are replaced by a short keyed fingerprint instead of a bare marker, so the
 * audit viewer can still see THAT a field changed (the fingerprint differs) without the trail
 * holding the person's data. The key is server-side only; without it a fingerprint cannot be
 * reversed or confirmed against a guessed value.
 */
function fingerprint(value: unknown): string {
  const key = process.env.BETTER_AUTH_SECRET ?? 'audit-fingerprint';
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  const digest = createHmac('sha256', key).update('audit.pii.v1').update(text).digest('hex');
  return `[personal:${digest.slice(0, 8)}]`;
}
const MAX_DEPTH = 8;
const MAX_BYTES = 64 * 1024;

export type Snapshot = string | number | boolean | null | Snapshot[] | { [key: string]: Snapshot };

function convert(value: unknown, depth: number, seen: WeakSet<object>): Snapshot {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : String(value);
    case 'bigint':
      return value.toString();
    case 'function':
    case 'symbol':
      return null;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (depth >= MAX_DEPTH) return '[max depth]';
  const object = value as object;
  if (seen.has(object)) return '[circular]';
  seen.add(object);

  let result: Snapshot;
  if (Array.isArray(object)) {
    result = object.map((item) => convert(item, depth + 1, seen));
  } else if (
    'toJSON' in object &&
    typeof (object as { toJSON: unknown }).toJSON === 'function' &&
    !('minor' in object)
  ) {
    result = convert((object as { toJSON: () => unknown }).toJSON(), depth + 1, seen);
  } else {
    const entries: Array<[string, Snapshot]> = [];
    for (const [key, item] of Object.entries(object as Record<string, unknown>)) {
      if (item === undefined || typeof item === 'function') continue;
      // Secrets and personal data never enter the audit trail (INV-A9): ids and changed keys do.
      let converted: Snapshot;
      if (isSensitiveKey(key)) converted = REDACTED;
      else if (isPiiKey(key)) converted = item === null ? null : fingerprint(item);
      else converted = convert(item, depth + 1, seen);
      entries.push([key, converted]);
    }
    result = Object.fromEntries(entries);
  }
  seen.delete(object);
  return result;
}

export function toSnapshot(value: unknown): Snapshot {
  const snapshot = convert(value, 0, new WeakSet());
  const size = Buffer.byteLength(JSON.stringify(snapshot) ?? 'null');
  if (size <= MAX_BYTES) return snapshot;
  // Keep proof that something large was recorded, and a fingerprint to compare against later.
  const sha256 = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { truncated: true, bytes: size, sha256 };
}

/** Keys whose value differs between two snapshots, for quick review in the audit viewer. */
export function changedKeys(before: Snapshot, after: Snapshot): string[] {
  const isObject = (v: Snapshot): v is { [key: string]: Snapshot } =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObject(before) || !isObject(after)) return before === after ? [] : ['(value)'];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .sort();
}
