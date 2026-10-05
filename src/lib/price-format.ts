import { format, type Money } from './money';

/**
 * Display text for a price: the taka sign replaces the ISO code for BDT, as in all AUREN copy.
 * Display only; never parse this back into money. Shared by the storefront, emails and admin.
 */
export function formatPriceText(value: Money): string {
  return format(value, { trimZeroFraction: true }).replace(/^BDT\s?/, '৳');
}
