import 'server-only';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { env } from './env';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export type TrustedProxy = 'vercel' | 'forwarded' | 'none';

/** Safe default: only trust headers a platform we run on is known to overwrite. */
export function defaultTrustedProxy(input: { vercel: boolean; production: boolean }): TrustedProxy {
  if (input.vercel) return 'vercel';
  return input.production ? 'none' : 'forwarded';
}

/** Valid IP only; IPv6 collapses to its /64 so one subnet is one identity. */
export function normalizeIp(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > 45) return null;
  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind === 6) {
    const groups = value.toLowerCase().split(':');
    // Expand "::" so we can take the first four groups.
    const gap = groups.indexOf('');
    const head = gap === -1 ? groups : groups.slice(0, gap);
    const tail = gap === -1 ? [] : groups.slice(gap).filter(Boolean);
    const full = [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail];
    return `${full
      .slice(0, 4)
      .map((g) => g || '0')
      .join(':')}::/64`;
  }
  return null;
}

/**
 * The client address from proxy headers, according to the trusted-proxy mode. Platform headers
 * win over `x-forwarded-for`, whose left-most entry a client can forge unless a proxy rewrites it.
 */
export function clientIp(
  source: { get(name: string): string | null },
  mode: TrustedProxy = 'forwarded',
): string | null {
  if (mode === 'none') return null;
  const platform = source.get('x-vercel-forwarded-for') ?? source.get('x-real-ip');
  if (platform) return normalizeIp(platform.split(',')[0]);
  if (mode === 'vercel') return null;
  return normalizeIp(source.get('x-forwarded-for')?.split(',')[0]);
}

export const trustedProxyMode = (): TrustedProxy =>
  env.TRUSTED_PROXY ??
  defaultTrustedProxy({
    vercel: process.env.VERCEL === '1',
    production: env.NODE_ENV === 'production',
  });

/** The address of this request under the configured trust mode. */
export const requestIp = (source: { get(name: string): string | null }): string | null =>
  clientIp(source, trustedProxyMode());

/** Client address and user agent of the current request, for the audit trail. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return { ip: requestIp(h), userAgent: h.get('user-agent')?.slice(0, 300) ?? null };
}
