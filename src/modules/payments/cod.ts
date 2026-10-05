import { compare, format, money } from '@/lib/money';
import type { EligibilityContext, PaymentProvider } from './provider';

/**
 * Cash on delivery (5.2). Available when it is switched on, the delivery rate for the address
 * allows it, and the order is not above the configured maximum. The maximum is enforced here, on
 * the server, whatever the browser showed (the checkout page only repeats the answer).
 */
export const codProvider: PaymentProvider = {
  id: 'cod',
  label: 'Cash on delivery',
  description: 'Pay in cash when your order arrives. Our team confirms it with you first.',

  checkEligibility({ total, deliveryAllowsCod, cod }: EligibilityContext) {
    if (!cod.enabled) {
      return { available: false, reason: 'Cash on delivery is not available right now.' };
    }
    if (!deliveryAllowsCod) {
      return {
        available: false,
        reason: 'Cash on delivery is not available for this delivery area.',
      };
    }
    const limit = money(BigInt(cod.maxOrderMinor), total.currency);
    if (compare(total, limit) > 0) {
      const text = format(limit, { trimZeroFraction: true }).replace(/^BDT\s?/, '৳');
      return {
        available: false,
        reason: `Cash on delivery is available for orders up to ${text}. Please choose another way to pay.`,
      };
    }
    return { available: true };
  },

  plan() {
    return {
      stock: 'commit_on_place',
      orderPaymentStatus: 'unpaid',
      record: { method: 'cash', status: 'pending' },
    };
  },
};
