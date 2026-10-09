import { describe, expect, it } from 'vitest';
import { isDomainError } from '@/lib/errors';
import {
  CANCELLABLE_STATUSES,
  STAFF_ONLY_STATUSES,
  TRANSITIONS,
  assertTransition,
  canTransition,
} from '../state-machine';
import type { OrderStatus } from '../timeline';

const ALL = Object.keys(TRANSITIONS) as OrderStatus[];

describe('order state machine (INV-O1, INV-O2)', () => {
  it('knows every status and only moves to known statuses', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) expect(ALL, `${from} -> ${to}`).toContain(to);
    }
  });

  it('follows the lifecycle in ARCHITECTURE section 6', () => {
    const path: OrderStatus[] = [
      'placed',
      'under_verification',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'completed',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i]!, path[i + 1]!, 'staff')).toBe(true);
    }
    expect(canTransition('on_hold', 'under_verification')).toBe(true);
    expect(canTransition('under_verification', 'on_hold')).toBe(true);
    expect(canTransition('shipped', 'delivery_failed')).toBe(true);
    expect(canTransition('delivery_failed', 'returned_to_origin')).toBe(true);
    expect(canTransition('delivered', 'return_requested')).toBe(true);
    expect(canTransition('returned', 'refunded')).toBe(true);
  });

  it('refuses shortcuts: nothing skips verification, shipping or delivery', () => {
    expect(canTransition('placed', 'processing')).toBe(false);
    expect(canTransition('placed', 'shipped')).toBe(false);
    expect(canTransition('placed', 'delivered')).toBe(false);
    expect(canTransition('confirmed', 'shipped')).toBe(false);
    expect(canTransition('on_hold', 'processing')).toBe(false);
    expect(canTransition('shipped', 'completed')).toBe(false);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('shipped', 'cancelled')).toBe(false);
  });

  it('terminal statuses have no way out', () => {
    for (const status of [
      'cancelled',
      'completed',
      'refunded',
      'exchanged',
      'returned_to_origin',
      'payment_expired',
    ] as const) {
      expect(TRANSITIONS[status]).toEqual([]);
    }
  });

  it('confirmed is reachable only from the verification statuses', () => {
    const sources = ALL.filter((from) => TRANSITIONS[from].includes('confirmed'));
    expect(sources.sort()).toEqual(['on_hold', 'placed', 'under_verification']);
  });

  it('a system actor (job, webhook) can never confirm or cancel (INV-O1, INV-O2)', () => {
    for (const to of STAFF_ONLY_STATUSES) {
      for (const from of ALL) {
        expect(canTransition(from, to, 'system'), `${from} -> ${to} by the system`).toBe(false);
      }
    }
    try {
      assertTransition('placed', 'confirmed', 'system');
      expect.unreachable();
    } catch (error) {
      expect(isDomainError(error) && error.code).toBe('INVALID_TRANSITION');
    }
    try {
      assertTransition('on_hold', 'cancelled', 'system');
      expect.unreachable();
    } catch (error) {
      expect(isDomainError(error) && error.code).toBe('INVALID_TRANSITION');
    }
  });

  it('a system actor can still do the automatic moves', () => {
    expect(canTransition('delivered', 'completed', 'system')).toBe(true);
    expect(canTransition('pending_payment', 'payment_expired', 'system')).toBe(true);
  });

  it('only orders before the parcel leaves can be cancelled by staff', () => {
    expect([...CANCELLABLE_STATUSES].sort()).toEqual([
      'confirmed',
      'on_hold',
      'placed',
      'processing',
      'under_verification',
    ]);
  });

  it('assertTransition explains a refused move', () => {
    expect(() => assertTransition('placed', 'shipped')).toThrow(/cannot become/);
    expect(() => assertTransition('placed', 'under_verification')).not.toThrow();
  });
});
