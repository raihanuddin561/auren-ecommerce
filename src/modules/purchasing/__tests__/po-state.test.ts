import { describe, expect, it } from 'vitest';
import {
  assertPoTransition,
  canAddLandedCost,
  canReceive,
  canTransition,
  isEditable,
  statusAfterReceipt,
  type PoStatus,
} from '../po-state';

const ALL: PoStatus[] = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];

describe('purchase order state machine', () => {
  it('follows draft, ordered, partially received, received', () => {
    expect(canTransition('draft', 'ordered')).toBe(true);
    expect(canTransition('ordered', 'partially_received')).toBe(true);
    expect(canTransition('partially_received', 'received')).toBe(true);
    expect(canTransition('ordered', 'received')).toBe(true);
  });

  it('can be cancelled only before anything arrives', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('ordered', 'cancelled')).toBe(true);
    expect(canTransition('partially_received', 'cancelled')).toBe(false);
  });

  it('received and cancelled are final', () => {
    for (const to of ALL) {
      expect(canTransition('received', to)).toBe(false);
      expect(canTransition('cancelled', to)).toBe(false);
    }
  });

  it('throws INVALID_TRANSITION for a forbidden move', () => {
    expect(() => assertPoTransition('draft', 'received')).toThrowError(/cannot become/);
    try {
      assertPoTransition('cancelled', 'ordered');
    } catch (error) {
      expect((error as { code: string }).code).toBe('INVALID_TRANSITION');
    }
  });

  it('only drafts are editable; goods arrive against open orders', () => {
    expect(ALL.filter(isEditable)).toEqual(['draft']);
    expect(ALL.filter(canReceive)).toEqual(['ordered', 'partially_received']);
    expect(ALL.filter(canAddLandedCost)).toEqual(['draft', 'ordered']);
  });

  it('is partially received until every line is complete', () => {
    expect(
      statusAfterReceipt([
        { quantityOrdered: 10, quantityReceived: 10 },
        { quantityOrdered: 5, quantityReceived: 2 },
      ]),
    ).toBe('partially_received');
    expect(
      statusAfterReceipt([
        { quantityOrdered: 10, quantityReceived: 10 },
        { quantityOrdered: 5, quantityReceived: 5 },
      ]),
    ).toBe('received');
  });
});
