import { describe, expect, it } from 'vitest';
import {
  AWAITING_VERIFICATION,
  OPEN_ORDER_STATUSES,
  STATUS_LABEL,
  isAwaitingVerification,
  timelineFor,
  type OrderStatus,
} from '../timeline';

const states = (status: OrderStatus) => timelineFor(status).steps.map((step) => step.state);

describe('customer timeline: Placed, Verified, Shipped, Delivered', () => {
  it('a new order is at Placed with the concierge line', () => {
    expect(timelineFor('placed').steps.map((s) => s.label)).toEqual([
      'Placed',
      'Verified',
      'Shipped',
      'Delivered',
    ]);
    expect(states('placed')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(timelineFor('placed').note).toMatch(/personally confirm your order shortly/);
  });

  it('verification and hold keep the order at Placed (the call is still ahead)', () => {
    expect(states('under_verification')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(states('on_hold')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('moves forward as the order does', () => {
    expect(states('confirmed')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(states('processing')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(states('shipped')).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(states('delivered')).toEqual(['done', 'done', 'done', 'current']);
    expect(states('completed')).toEqual(['done', 'done', 'done', 'current']);
  });

  it('a cancelled order shows nothing as progressing and says it was cancelled', () => {
    const cancelled = timelineFor('cancelled');
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.steps.every((s) => s.state === 'upcoming')).toBe(true);
    expect(cancelled.note).toBe('This order was cancelled.');
  });

  it('an expired payment never claims an order was placed', () => {
    expect(timelineFor('payment_expired').note).toMatch(/no order was placed/);
  });
});

describe('status groups', () => {
  it('orders awaiting verification are placed, under verification and on hold', () => {
    expect([...AWAITING_VERIFICATION]).toEqual(['placed', 'under_verification', 'on_hold']);
    expect(isAwaitingVerification('placed')).toBe(true);
    expect(isAwaitingVerification('confirmed')).toBe(false);
    expect([...OPEN_ORDER_STATUSES]).toEqual([...AWAITING_VERIFICATION]);
  });

  it('every status has a label and the owner-facing one for placed says awaiting verification', () => {
    expect(STATUS_LABEL.placed).toBe('Awaiting verification');
    for (const label of Object.values(STATUS_LABEL)) expect(label.length).toBeGreaterThan(2);
  });
});
