import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_SESSION_SECONDS,
  STAFF_SESSION_MAX_SECONDS,
  staffSessionExpiresAt,
  staffSessionTooOld,
} from '../session-policy';

const now = new Date('2026-10-02T08:00:00Z');
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe('session policy', () => {
  it('keeps the staff cap within 8 to 12 hours and below the customer lifetime', () => {
    expect(STAFF_SESSION_MAX_SECONDS).toBeGreaterThanOrEqual(8 * 3600);
    expect(STAFF_SESSION_MAX_SECONDS).toBeLessThanOrEqual(12 * 3600);
    expect(STAFF_SESSION_MAX_SECONDS).toBeLessThan(CUSTOMER_SESSION_SECONDS);
  });

  it('caps a long requested expiry and keeps a shorter one', () => {
    expect(staffSessionExpiresAt(now, hours(24 * 30)).getTime()).toBe(
      now.getTime() + STAFF_SESSION_MAX_SECONDS * 1000,
    );
    expect(staffSessionExpiresAt(now).getTime()).toBe(
      now.getTime() + STAFF_SESSION_MAX_SECONDS * 1000,
    );
    expect(staffSessionExpiresAt(now, hours(1)).getTime()).toBe(hours(1).getTime());
  });

  it('flags a staff session once it has existed for the full cap', () => {
    expect(staffSessionTooOld(now, hours(9))).toBe(false);
    expect(staffSessionTooOld(now, hours(10))).toBe(true);
    expect(staffSessionTooOld(now, hours(30))).toBe(true);
  });
});
