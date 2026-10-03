import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';
import { clientIp, defaultTrustedProxy, type TrustedProxy } from './trusted-proxy';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export {
  clientIp,
  defaultTrustedProxy,
  isTrustedProxy,
  normalizeIp,
  type TrustedProxy,
} from './trusted-proxy';

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
