/**
 * Bangladesh mobile numbers. Customers type them many ways (01712 345678, +880 1712-345678,
 * 8801712345678); everything stored, compared and rate limited uses one form: E.164, +8801XXXXXXXXX.
 * Client-safe: no server imports.
 */

const MOBILE = /^01[3-9]\d{8}$/;

/** E.164 (+8801XXXXXXXXX) for a Bangladesh mobile number, or null when it is not one. */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/[\s().-]/g, '');
  let national: string;
  if (/^\+8801\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^8801\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^008801\d{9}$/.test(digits)) national = digits.slice(4);
  else national = digits;
  if (!MOBILE.test(national)) return null;
  return `+880${national.slice(1)}`;
}

/** 01712 345678 for display (never used for comparison). */
export function formatBdPhone(e164: string): string {
  const national = e164.replace(/^\+880/, '0');
  return national.length === 11 ? `${national.slice(0, 5)} ${national.slice(5)}` : e164;
}

/** j***@gmail.com and +880 17** ***678, for logs and the send log. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(e164: string): string {
  return e164.length > 6 ? `${e164.slice(0, 6)}***${e164.slice(-3)}` : '***';
}
