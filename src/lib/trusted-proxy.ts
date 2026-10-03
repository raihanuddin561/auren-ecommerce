/**
 * Client address resolution from proxy headers. Pure (no server-only imports) so the environment
 * schema can validate TRUSTED_PROXY with the same parser the request code uses.
 */
import { isIP } from 'node:net';
import { HOPS, isTrustedProxy, type TrustedProxy } from './env/proxy-mode';

export { isTrustedProxy, type TrustedProxy };

/**
 * Which proxy headers identify the client address.
 *   vercel      x-vercel-forwarded-for (set by Vercel's edge; clients cannot supply it)
 *   hops:N      the Nth address from the RIGHT of x-forwarded-for, for N trusted proxies of your own
 *               (hops:1 = one proxy appends the address it saw; the right-most entry is the client)
 *   forwarded   the LEFT-most x-forwarded-for entry: client controlled, development only
 *   none        proxy headers are ignored
 */

/** Safe default: only trust headers a platform we run on is known to overwrite. */
export function defaultTrustedProxy(input: { vercel: boolean; production: boolean }): TrustedProxy {
  if (input.vercel) return 'vercel';
  return input.production ? 'none' : 'forwarded';
}

/**
 * Eight 16-bit groups of an IPv6 address, or null. Handles "::" and an embedded IPv4 tail, and
 * ignores leading zeros, so every spelling of one address gives the same groups.
 */
function ipv6Groups(value: string): number[] | null {
  let text = value.toLowerCase();
  const tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text)?.[1];
  if (tail) {
    if (isIP(tail) !== 4) return null;
    const [a, b, c, d] = tail.split('.').map(Number) as [number, number, number, number];
    text =
      text.slice(0, text.length - tail.length) +
      ((a << 8) | b).toString(16) +
      ':' +
      ((c << 8) | d).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = halves.length === 1 ? head : [...head, ...Array(missing).fill('0'), ...rest];
  const numbers = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : Number.NaN));
  return numbers.some(Number.isNaN) ? null : numbers;
}

/** Valid IP only; IPv6 collapses to its /64 so one subnet is one identity. */
export function normalizeIp(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > 45 || value.includes('%')) return null;
  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind !== 6) return null;
  const groups = ipv6Groups(value);
  if (!groups) return null;
  // ::ffff:1.2.3.4 (or ::ffff:102:304) is the IPv4 client 1.2.3.4 seen through a dual-stack socket.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return `${groups[6]! >> 8}.${groups[6]! & 255}.${groups[7]! >> 8}.${groups[7]! & 255}`;
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}

/**
 * The client address from proxy headers, according to the trusted-proxy mode. Only addresses a
 * proxy of ours wrote are used: the platform header on Vercel, or a fixed distance from the right
 * end of x-forwarded-for (everything left of that is whatever the client chose to send).
 */
export function clientIp(
  source: { get(name: string): string | null },
  mode: TrustedProxy = 'forwarded',
): string | null {
  if (mode === 'none') return null;
  if (mode === 'vercel') {
    return normalizeIp(source.get('x-vercel-forwarded-for')?.split(',')[0]);
  }
  const hops = HOPS.exec(mode)?.[1];
  if (hops) {
    const chain = (source.get('x-forwarded-for') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return normalizeIp(chain[chain.length - Number(hops)]);
  }
  // 'forwarded' (development): platform headers first, then the left-most forwarded address.
  const platform = source.get('x-vercel-forwarded-for') ?? source.get('x-real-ip');
  if (platform) return normalizeIp(platform.split(',')[0]);
  return normalizeIp(source.get('x-forwarded-for')?.split(',')[0]);
}
