import { randomFillSync } from 'node:crypto';

let lastMs = 0;
let sequence = 0;

/** Test helper: forget the last timestamp so tests can control the clock. */
export function resetIdState(): void {
  lastMs = 0;
  sequence = 0;
}

/**
 * RFC 9562 UUIDv7: 48-bit unix millisecond timestamp, then random bits, so ids sort by creation time.
 * A 12-bit counter keeps ids generated within the same millisecond strictly increasing.
 * Prisma generates ids for normal inserts (`uuid(7)`); use this for raw SQL, fixtures and idempotency.
 */
export function newId(now: number = Date.now()): string {
  let ms = now;
  if (ms <= lastMs) {
    ms = lastMs;
    sequence += 1;
    if (sequence > 0xfff) {
      ms += 1;
      sequence = 0;
    }
  } else {
    sequence = 0;
  }
  lastMs = ms;

  const bytes = new Uint8Array(16);
  randomFillSync(bytes);
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = (ms >>> 24) & 0xff;
  bytes[3] = (ms >>> 16) & 0xff;
  bytes[4] = (ms >>> 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = 0x70 | ((sequence >>> 8) & 0x0f);
  bytes[7] = sequence & 0xff;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
