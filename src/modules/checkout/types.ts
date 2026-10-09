import type { SerializedMoney } from '@/lib/money';
import type { CartView } from '@/modules/cart/view';
import type { PaymentMethodOption } from '@/modules/payments/provider';

export interface DeliveryOptionView {
  rateId: string;
  name: string;
  charge: SerializedMoney;
  listed: SerializedMoney;
  free: boolean;
  eta: string;
  codAllowed: boolean;
}

export interface CheckoutSummary {
  cart: CartView;
  delivery: { zoneName: string; options: DeliveryOptionView[]; selectedRateId: string } | null;
  methods: PaymentMethodOption[];
  totals: {
    subtotal: SerializedMoney;
    discount?: SerializedMoney | null;
    shipping: SerializedMoney | null;
    total: SerializedMoney | null;
  };
  discount?: {
    code: string;
    title: string;
    amount: SerializedMoney;
    freeShipping: boolean;
  } | null;
  /** True when a phone code is required before an order can be placed. */
  otpRequired: boolean;
}
