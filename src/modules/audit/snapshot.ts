import { createHash } from 'node:crypto';
import { isSensitiveKey } from '@/lib/sensitive';

/**
 * Turns domain objects into the JSON stored in the audit trail: money and ids stay exact
 * (bigint becomes text), dates become ISO strings, secrets are removed, and oversized values are
 * cut so one careless call cannot bloat the table.
 */

const REDACTED = '[redacted]';
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
      entries.push([key, isSensitiveKey(key) ? REDACTED : convert(item, depth + 1, seen)]);
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
