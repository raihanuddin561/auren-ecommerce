/** Proxy trust modes, parsed without any Node-only imports (shared by the client-safe env schema). */
export type TrustedProxy = 'vercel' | 'forwarded' | 'none' | `hops:${number}`;

export const HOPS = /^hops:([1-9][0-9]?)$/;

export const isTrustedProxy = (value: string): value is TrustedProxy =>
  value === 'vercel' || value === 'forwarded' || value === 'none' || HOPS.test(value);
