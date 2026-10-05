import { randomInt } from 'node:crypto';
import { hmacHex } from '@/lib/order-secret';

/** Phone codes for checkout (4.8): six digits, five minutes, hashed at rest. */

export const OTP_TTL_MS = 5 * 60_000;
/** After a correct code, the phone counts as verified for this long. */
export const OTP_PROOF_TTL_MS = 30 * 60_000;

export const otpIdentifier = (phone: string) => `checkout-otp:${phone}`;
export const otpProofIdentifier = (phone: string) => `checkout-otp-proof:${phone}`;

export const generateOtpCode = (): string => randomInt(0, 1_000_000).toString().padStart(6, '0');

/** Keyed hash of the code, bound to the phone, so a stolen row cannot be replayed elsewhere. */
export const hashOtp = (phone: string, code: string): string =>
  hmacHex('checkout-otp:v1', `${phone}:${code}`);

export const otpMessage = (code: string): string =>
  `AUREN: ${code} is your code to place your order. It expires in 5 minutes. Do not share it.`;
