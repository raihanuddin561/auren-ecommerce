/**
 * Decides whether an object key probably holds a secret or personal data, so audit snapshots and
 * error reports can drop the value. Matching is by whole word (camelCase and snake_case are split
 * first), so `passwordHash` and `reset_token` match but `cardigan` and `footprint` do not.
 */

const SENSITIVE_WORDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'otp',
  'card',
  'cvv',
  'cvc',
  'ssn',
  'jwt',
  'bearer',
]);

/** Multi-word names that only mean something together. */
const SENSITIVE_COMPOUNDS = ['apikey', 'backupcode', 'cardnumber', 'privatekey', 'sessionid'];

const words = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

export function isSensitiveKey(key: string): boolean {
  const parts = words(key);
  if (parts.some((part) => SENSITIVE_WORDS.has(part))) return true;
  const joined = parts.join('');
  return SENSITIVE_COMPOUNDS.some((compound) => joined.includes(compound));
}
