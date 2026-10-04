import { DomainError } from '@/lib/errors';

/** Purchase order lifecycle: draft, ordered, partially_received, received, cancelled. */
export type PoStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

const TRANSITIONS: Readonly<Record<PoStatus, readonly PoStatus[]>> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['partially_received', 'received', 'cancelled'],
  partially_received: ['partially_received', 'received'],
  received: [],
  cancelled: [],
};

export const canTransition = (from: PoStatus, to: PoStatus): boolean =>
  TRANSITIONS[from].includes(to);

export function assertPoTransition(from: PoStatus, to: PoStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `A ${label(from)} order cannot become ${label(to)}.`,
    );
  }
}

/** Lines, supplier and dates can change only before the order is sent. */
export const isEditable = (status: PoStatus): boolean => status === 'draft';

/** Goods can be received once the order is placed and until everything has arrived. */
export const canReceive = (status: PoStatus): boolean =>
  status === 'ordered' || status === 'partially_received';

/**
 * Landed costs can be added or removed only while nothing has arrived: a unit that has been
 * received already carries its share, and a line that is fully received has no later delivery to
 * carry a new one (INV-F3).
 */
export const canAddLandedCost = (status: PoStatus): boolean =>
  status === 'draft' || status === 'ordered';

/** The status after a delivery, from the quantities now received. */
export function statusAfterReceipt(
  lines: ReadonlyArray<{ quantityOrdered: number; quantityReceived: number }>,
): 'partially_received' | 'received' {
  return lines.every((line) => line.quantityReceived >= line.quantityOrdered)
    ? 'received'
    : 'partially_received';
}

export const label = (status: PoStatus): string => status.replace('_', ' ');
