import { isIP } from 'node:net';
import { normalizeIp } from './trusted-proxy';

/**
 * Optional network restriction for the most powerful staff roles (owner and finance), so a stolen
 * password and session cookie are useless from outside the office or VPN.
 *
 * PRIVILEGED_IP_ALLOWLIST is a comma separated list of IPv4 addresses, IPv4 CIDR ranges
 * (203.0.113.0/24) and IPv6 addresses (matched at /64, the same granularity as rate limits).
 * Unset means "no restriction". A malformed list restricts everyone (fail closed) rather than
 * silently allowing everyone.
 */
export const PRIVILEGED_ROLES = ['owner', 'finance'] as const;

export interface AllowEntry {
  kind: 'v4' | 'v6';
  /** IPv4: network as a 32 bit unsigned number; IPv6: the normalized /64 label. */
  network: number | string;
  mask?: number;
}

const ipv4ToNumber = (ip: string): number =>
  ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);

/** Parses the list; returns null when it is not valid (callers must then deny). */
export function parseAllowlist(raw: string | undefined): AllowEntry[] | null | 'unset' {
  if (raw === undefined || raw.trim() === '') return 'unset';
  const entries: AllowEntry[] = [];
  for (const part of raw.split(',').map((p) => p.trim())) {
    if (!part) return null;
    const [address, prefix, ...extra] = part.split('/');
    if (extra.length > 0 || !address) return null;
    const kind = isIP(address);
    if (kind === 4) {
      const bits = prefix === undefined ? 32 : Number(prefix);
      if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      entries.push({ kind: 'v4', network: (ipv4ToNumber(address) & mask) >>> 0, mask });
    } else if (kind === 6) {
      if (prefix !== undefined && prefix !== '64') return null;
      const label = normalizeIp(address);
      if (!label) return null;
      entries.push({ kind: 'v6', network: label });
    } else {
      return null;
    }
  }
  return entries;
}

/** Whether `ip` (as returned by the trusted-proxy resolver) may use privileged roles. */
export function ipAllowed(ip: string | null, raw: string | undefined): boolean {
  const list = parseAllowlist(raw);
  if (list === 'unset') return true;
  if (list === null || ip === null) return false;
  return list.some((entry) => {
    if (entry.kind === 'v6') return entry.network === ip;
    if (isIP(ip) !== 4) return false;
    return (ipv4ToNumber(ip) & (entry.mask ?? 0xffffffff)) >>> 0 === entry.network;
  });
}
