import type { Money } from '@/lib/money';
import type { CodSettings } from '@/modules/settings/schemas';

/**
 * The contract every payment method implements (5.1). A provider answers three questions: can this
 * customer use it for this order, what happens to stock and payment status when the order is
 * placed, and (for online methods, added later) how a payment is started and confirmed.
 *
 * Online gateways (SSLCommerz, Stripe) are not registered yet: they need merchant accounts. When
 * they arrive they implement the same interface and add `start` and `verifyAndParse`; checkout and
 * the order service do not change. The rules that make online methods safe (INV-P1, INV-P2, INV-P5:
 * the webhook payload alone never marks an order paid) belong in those adapters.
 */

export type PaymentProviderId = 'cod' | 'sslcommerz' | 'stripe' | 'bkash';

export interface EligibilityContext {
  /** What the customer would pay, delivery included. */
  total: Money;
  /** Whether the chosen delivery rate allows cash on delivery. */
  deliveryAllowsCod: boolean;
  cod: CodSettings;
}

export type Eligibility = { available: true } | { available: false; reason: string };

/** What placing an order with this method does to stock and payment bookkeeping. */
export interface PlacementPlan {
  /**
   * `commit_on_place`: stock leaves on hand when the order is placed (cash on delivery).
   * `reserve_until_paid`: stock is held for 15 minutes and committed on payment (online).
   */
  stock: 'commit_on_place' | 'reserve_until_paid';
  /** The order's payment status at placement. */
  orderPaymentStatus: 'unpaid' | 'pending';
  /** The payment record written with the order. */
  record: {
    method: string;
    status: 'pending' | 'initiated';
  };
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Shown to the customer. */
  readonly label: string;
  readonly description: string;
  checkEligibility(context: EligibilityContext): Eligibility;
  plan(): PlacementPlan;
}

export interface PaymentMethodOption {
  id: PaymentProviderId;
  label: string;
  description: string;
  available: boolean;
  /** Why it cannot be used, in words the customer can act on. */
  reason?: string;
}
