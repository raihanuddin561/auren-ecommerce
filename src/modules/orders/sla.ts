/**
 * Verification SLA arithmetic (6.15, OD-11). Pure: the clock is always passed in.
 *
 * The target is "placed to verified within N working minutes". Only minutes inside the working
 * window count, so an order placed at midnight is not overdue at 2 a.m. Bangladesh has no daylight
 * saving, so the shop clock is a fixed offset from UTC.
 */

import type { VerificationSettings } from '@/modules/settings/schemas';

/** Asia/Dhaka is UTC+6 all year. */
const SHOP_OFFSET_MS = 6 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_DAYS = 90;

/** Working minutes between two instants (zero when `to` is not after `from`). */
export function workingMinutesBetween(
  from: Date,
  to: Date,
  hours: Pick<VerificationSettings, 'workStartHour' | 'workEndHour'>,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  const start = from.getTime();
  const end = Math.min(to.getTime(), start + MAX_DAYS * DAY_MS);
  // The shop day containing `start`, as a UTC timestamp of its local midnight.
  let dayStart = Math.floor((start + SHOP_OFFSET_MS) / DAY_MS) * DAY_MS - SHOP_OFFSET_MS;
  let total = 0;
  while (dayStart < end) {
    const open = dayStart + hours.workStartHour * 3600 * 1000;
    const close = dayStart + hours.workEndHour * 3600 * 1000;
    const overlap = Math.min(close, end) - Math.max(open, start);
    if (overlap > 0) total += overlap;
    dayStart += DAY_MS;
  }
  return Math.floor(total / MINUTE_MS);
}

export interface SlaState {
  /** Working minutes since the order was placed. */
  elapsedMinutes: number;
  /** Working minutes left before the target (negative once overdue). */
  remainingMinutes: number;
  overdue: boolean;
}

export function slaState(placedAt: Date, now: Date, settings: VerificationSettings): SlaState {
  const elapsedMinutes = workingMinutesBetween(placedAt, now, settings);
  return {
    elapsedMinutes,
    remainingMinutes: settings.slaMinutes - elapsedMinutes,
    overdue: elapsedMinutes > settings.slaMinutes,
  };
}

/** A claim still keeps the order for its holder. */
export const claimIsActive = (claimExpiresAt: Date | null, now: Date): boolean =>
  claimExpiresAt !== null && claimExpiresAt.getTime() > now.getTime();

/** "Needs manager review" after this many failed contact attempts. It never cancels anything. */
export const needsManagerReview = (failedAttempts: number, threshold: number): boolean =>
  threshold > 0 && failedAttempts >= threshold;

/** Outcomes that count as a failed attempt to reach the customer. */
export const FAILED_CONTACT_OUTCOMES = ['no_answer', 'busy', 'wrong_number'] as const;

/** "1 h 40 min" from minutes (the sign is ignored; callers say overdue or left). */
export function minutesText(minutes: number): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
