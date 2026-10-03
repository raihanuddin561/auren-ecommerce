import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  let bits = '';
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`not base32: ${char}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 time-based one-time code (SHA-1, 6 digits, 30 s), for tests only. */
export function totp(base32Secret: string, atMs: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(base32Secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
}

/** The `secret` query parameter of an otpauth:// URI. */
export const secretFromUri = (uri: string): string => new URL(uri).searchParams.get('secret') ?? '';

/** Narrows the result of enabling two-factor to the authenticator-app variant. */
export function totpSecretOf(enrol: { method: string; totpURI?: string }): string {
  if (enrol.method !== 'totp' || !enrol.totpURI)
    throw new Error('expected an authenticator-app enrolment');
  return secretFromUri(enrol.totpURI);
}
