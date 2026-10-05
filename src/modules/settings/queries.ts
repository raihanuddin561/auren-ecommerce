import { toDecimalString, money } from '@/lib/money';
import { getCheckoutProtection, getCodSettings } from './service';
import type { CheckoutSettingsView } from './types';

/** Cash on delivery and checkout protection as the settings form shows them. */
export async function getCheckoutSettingsForAdmin(): Promise<CheckoutSettingsView> {
  const [protection, cod] = await Promise.all([getCheckoutProtection(), getCodSettings()]);
  return {
    ...protection,
    codEnabled: cod.enabled,
    codMaxOrder: toDecimalString(money(BigInt(cod.maxOrderMinor), 'BDT')),
  };
}
