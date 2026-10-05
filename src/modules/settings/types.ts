import type { CheckoutProtection } from './schemas';

export interface CheckoutSettingsView extends CheckoutProtection {
  codEnabled: boolean;
  /** Whole taka, for the form. */
  codMaxOrder: string;
}
