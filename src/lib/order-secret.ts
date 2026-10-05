import 'server-only';
import { createHmac } from 'node:crypto';
import { env } from './env';

/**
 * Keyed hashing for order privacy: tracking tokens, the lookup proof, and the address and network
 * fingerprints used for velocity limits. One secret, separated by a purpose label, so a value made
 * for one purpose can never be replayed for another.
 */
const secret = (): string => env.ORDER_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;

export const hmac = (purpose: string, value: string): Buffer =>
  createHmac('sha256', secret()).update(`${purpose}:${value}`).digest();

export const hmacHex = (purpose: string, value: string): string =>
  hmac(purpose, value).toString('hex');
