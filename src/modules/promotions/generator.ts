/**
 * High-entropy coupon code generator following e-commerce best practices:
 * - Unambiguous alphanumeric alphabet (excludes 0, O, 1, I, L to prevent user confusion).
 * - Standard branded prefix format (e.g. AUREN-7X9K2M, VIP-4K8P9Q).
 * - High entropy to protect against brute-force enumeration attacks.
 */

// 31 characters: 23456789ABCDEFGHJKMNPQRSTUVWXYZ
export const UNAMBIGUOUS_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export interface CouponGeneratorOptions {
  /** Optional branded prefix, e.g. "AUREN", "VIP", "SUMMER". Defaults to "AUREN". */
  prefix?: string;
  /** Length of the random entropy portion. Defaults to 6 characters. */
  length?: number;
}

/**
 * Generates a clean, human-readable, unambiguous coupon code.
 * Example outputs: "AUREN-7X9K2M", "VIP-K9P4X2", "FESTIVE-8R3N5W".
 */
export function generateCouponCode(options: CouponGeneratorOptions = {}): string {
  const prefix = options.prefix !== undefined ? options.prefix.trim().toUpperCase() : 'AUREN';
  const length = Math.max(4, Math.min(16, options.length ?? 6));

  let entropy = '';
  const charsetLength = UNAMBIGUOUS_CHARSET.length;

  // Use crypto.getRandomValues in modern environments if available, fallback to Math.random
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      entropy += UNAMBIGUOUS_CHARSET[randomBytes[i]! % charsetLength];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charsetLength);
      entropy += UNAMBIGUOUS_CHARSET[randomIndex];
    }
  }

  return prefix ? `${prefix}-${entropy}` : entropy;
}

/**
 * Validates whether a coupon code conforms to allowed characters and length.
 */
export function isValidCouponFormat(code: string): boolean {
  const clean = code.trim().toUpperCase();
  return /^[A-Z0-9\-_]{3,30}$/.test(clean);
}
