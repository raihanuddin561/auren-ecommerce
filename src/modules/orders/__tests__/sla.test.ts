import { describe, expect, it } from 'vitest';
import { DEFAULT_VERIFICATION_SETTINGS } from '@/modules/settings/schemas';
import { claimIsActive, needsManagerReview, slaState, workingMinutesBetween } from '../sla';

const hours = { workStartHour: 10, workEndHour: 21 };
// Shop time is UTC+6: 10:00 in Dhaka is 04:00 UTC.
const dhaka = (iso: string) => new Date(`${iso}+06:00`);

describe('working minutes (OD-11)', () => {
  it('counts every minute inside the working day', () => {
    expect(
      workingMinutesBetween(dhaka('2026-10-05T10:30:00'), dhaka('2026-10-05T12:30:00'), hours),
    ).toBe(120);
  });

  it('does not count the night', () => {
    // 20:30 to 10:30 next day = 30 minutes before closing + 30 after opening.
    expect(
      workingMinutesBetween(dhaka('2026-10-05T20:30:00'), dhaka('2026-10-06T10:30:00'), hours),
    ).toBe(60);
  });

  it('an order placed at night starts counting when the shop opens', () => {
    expect(
      workingMinutesBetween(dhaka('2026-10-05T23:00:00'), dhaka('2026-10-06T09:00:00'), hours),
    ).toBe(0);
    expect(
      workingMinutesBetween(dhaka('2026-10-05T23:00:00'), dhaka('2026-10-06T11:00:00'), hours),
    ).toBe(60);
  });

  it('spans whole days', () => {
    // A full working day is 11 hours.
    expect(
      workingMinutesBetween(dhaka('2026-10-05T00:00:00'), dhaka('2026-10-07T00:00:00'), hours),
    ).toBe(2 * 11 * 60);
  });

  it('is zero for an empty or reversed range', () => {
    const t = dhaka('2026-10-05T12:00:00');
    expect(workingMinutesBetween(t, t, hours)).toBe(0);
    expect(workingMinutesBetween(t, dhaka('2026-10-05T11:00:00'), hours)).toBe(0);
  });
});

describe('sla state', () => {
  const settings = { ...DEFAULT_VERIFICATION_SETTINGS, slaMinutes: 120 };

  it('is not overdue inside the target and overdue past it', () => {
    const placed = dhaka('2026-10-05T10:00:00');
    expect(slaState(placed, dhaka('2026-10-05T11:30:00'), settings)).toMatchObject({
      elapsedMinutes: 90,
      remainingMinutes: 30,
      overdue: false,
    });
    expect(slaState(placed, dhaka('2026-10-05T12:00:00'), settings).overdue).toBe(false);
    expect(slaState(placed, dhaka('2026-10-05T12:01:00'), settings)).toMatchObject({
      remainingMinutes: -1,
      overdue: true,
    });
  });

  it('an order placed after closing is not overdue at 2 a.m.', () => {
    expect(
      slaState(dhaka('2026-10-05T22:00:00'), dhaka('2026-10-06T02:00:00'), settings).overdue,
    ).toBe(false);
  });
});

describe('claims and escalation', () => {
  it('a claim holds only until it expires', () => {
    const now = new Date('2026-10-05T10:00:00Z');
    expect(claimIsActive(null, now)).toBe(false);
    expect(claimIsActive(new Date('2026-10-05T10:00:01Z'), now)).toBe(true);
    expect(claimIsActive(new Date('2026-10-05T10:00:00Z'), now)).toBe(false);
  });

  it('flags a manager after the threshold of failed attempts and never earlier', () => {
    expect(needsManagerReview(2, 3)).toBe(false);
    expect(needsManagerReview(3, 3)).toBe(true);
    expect(needsManagerReview(5, 3)).toBe(true);
  });
});
