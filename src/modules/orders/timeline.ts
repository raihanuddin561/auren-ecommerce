/** What the customer and the team are told about where an order stands. Pure and shared. */

export type OrderStatus =
  | 'pending_payment'
  | 'payment_expired'
  | 'placed'
  | 'under_verification'
  | 'on_hold'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'delivery_failed'
  | 'returned_to_origin'
  | 'completed'
  | 'return_requested'
  | 'returned'
  | 'refunded'
  | 'exchanged'
  | 'cancelled';

export const STEP_LABELS = ['Placed', 'Verified', 'Shipped', 'Delivered'] as const;
export type StepLabel = (typeof STEP_LABELS)[number];

export type StepState = 'done' | 'current' | 'upcoming';

export interface TimelineStep {
  label: StepLabel;
  state: StepState;
}

export interface Timeline {
  steps: TimelineStep[];
  /** One calm sentence about the current step. */
  note: string;
  cancelled: boolean;
}

/** Index of the last completed step, or -1 for an order that never got going. */
function reached(status: OrderStatus): number {
  switch (status) {
    case 'placed':
    case 'under_verification':
    case 'on_hold':
      return 0;
    case 'confirmed':
    case 'processing':
      return 1;
    case 'shipped':
    case 'delivery_failed':
    case 'returned_to_origin':
      return 2;
    case 'delivered':
    case 'completed':
    case 'return_requested':
    case 'returned':
    case 'refunded':
    case 'exchanged':
      return 3;
    default:
      return -1;
  }
}

const NOTES: Partial<Record<OrderStatus, string>> = {
  placed: 'Our team will personally confirm your order shortly, usually within 2 hours.',
  under_verification: 'Our team is confirming your order with you now.',
  on_hold: 'We tried to reach you. Please keep your phone close, or message our concierge.',
  confirmed: 'Confirmed. We are preparing your pieces.',
  processing: 'Confirmed. We are preparing your pieces.',
  shipped: 'On its way to you.',
  delivered: 'Delivered. We hope you love it.',
  completed: 'Delivered. We hope you love it.',
  cancelled: 'This order was cancelled.',
};

export function timelineFor(status: OrderStatus): Timeline {
  if (status === 'cancelled' || status === 'payment_expired' || status === 'pending_payment') {
    return {
      steps: STEP_LABELS.map((label) => ({ label, state: 'upcoming' as const })),
      note:
        status === 'cancelled'
          ? NOTES.cancelled!
          : status === 'payment_expired'
            ? 'The payment was not completed, so no order was placed.'
            : 'Waiting for your payment.',
      cancelled: status === 'cancelled',
    };
  }
  const done = reached(status);
  return {
    steps: STEP_LABELS.map((label, index) => ({
      label,
      state: index < done ? 'done' : index === done ? 'current' : 'upcoming',
    })),
    note: NOTES[status] ?? 'We are looking after your order.',
    cancelled: false,
  };
}

/** Orders that wait for the team's call (the verification queue, ARCHITECTURE section 6.1). */
export const AWAITING_VERIFICATION: readonly OrderStatus[] = [
  'placed',
  'under_verification',
  'on_hold',
];

export const isAwaitingVerification = (status: OrderStatus): boolean =>
  AWAITING_VERIFICATION.includes(status);

/** Orders that still hold stock for the customer and count toward velocity limits (INV-O11). */
export const OPEN_ORDER_STATUSES = AWAITING_VERIFICATION;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  payment_expired: 'Payment expired',
  placed: 'Awaiting verification',
  under_verification: 'Being verified',
  on_hold: 'On hold',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  returned_to_origin: 'Returned to origin',
  completed: 'Completed',
  return_requested: 'Return requested',
  returned: 'Returned',
  refunded: 'Refunded',
  exchanged: 'Exchanged',
  cancelled: 'Cancelled',
};
