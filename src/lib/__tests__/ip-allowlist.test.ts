import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { ipAllowed, parseAllowlist } from '../ip-allowlist';
import { resolveStaff } from '../staff';

describe('IP allowlist', () => {
  it('allows everything when unset', () => {
    expect(ipAllowed('203.0.113.9', undefined)).toBe(true);
    expect(ipAllowed(null, '')).toBe(true);
  });

  it('matches exact IPv4 addresses and CIDR ranges', () => {
    const list = '198.51.100.7, 203.0.113.0/24';
    expect(ipAllowed('198.51.100.7', list)).toBe(true);
    expect(ipAllowed('198.51.100.8', list)).toBe(false);
    expect(ipAllowed('203.0.113.200', list)).toBe(true);
    expect(ipAllowed('203.0.114.1', list)).toBe(false);
    expect(ipAllowed('1.2.3.4', '0.0.0.0/0')).toBe(true);
  });

  it('matches IPv6 at /64, the same granularity as the rate limits', () => {
    const list = '2001:db8:abcd:12::1';
    expect(ipAllowed('2001:db8:abcd:12::/64', list)).toBe(true);
    expect(ipAllowed('2001:db8:abcd:13::/64', list)).toBe(false);
    expect(ipAllowed('203.0.113.9', list)).toBe(false);
  });

  it('denies an unknown address when a list is configured', () => {
    expect(ipAllowed(null, '203.0.113.0/24')).toBe(false);
  });

  it('fails closed on a malformed list', () => {
    for (const bad of [
      'not-an-ip',
      '203.0.113.0/33',
      '203.0.113.0/24/1',
      '1.2.3.4,,5.6.7.8',
      '2001:db8::/48',
    ]) {
      expect(parseAllowlist(bad), bad).toBeNull();
      expect(ipAllowed('203.0.113.9', bad), bad).toBe(false);
    }
  });
});

describe('privileged roles and the allowlist', () => {
  const base = {
    user: {
      id: 'u1',
      name: 'Owner',
      email: 'o@auren.test',
      banned: false,
      twoFactorEnabled: true,
      mustChangePassword: false,
    },
    permissions: ['orders.verify'],
    sessionCreatedAt: new Date(),
  };
  const member = (role: 'owner' | 'finance' | 'support') => ({ id: 'm1', role, active: true });
  const at = (ip: string | null, allowlist: string | undefined) => ({ network: { ip, allowlist } });

  it('lets owner and finance in from the allowed network only', () => {
    for (const role of ['owner', 'finance'] as const) {
      expect(
        resolveStaff({ ...base, member: member(role), ...at('203.0.113.5', '203.0.113.0/24') })
          .status,
      ).toBe('ok');
      expect(
        resolveStaff({ ...base, member: member(role), ...at('198.51.100.5', '203.0.113.0/24') })
          .status,
      ).toBe('not_staff');
      expect(
        resolveStaff({ ...base, member: member(role), ...at(null, '203.0.113.0/24') }).status,
      ).toBe('not_staff');
    }
  });

  it('does not restrict other roles, and does nothing without a list', () => {
    expect(
      resolveStaff({ ...base, member: member('support'), ...at('198.51.100.5', '203.0.113.0/24') })
        .status,
    ).toBe('ok');
    expect(
      resolveStaff({ ...base, member: member('owner'), ...at('198.51.100.5', undefined) }).status,
    ).toBe('ok');
    expect(resolveStaff({ ...base, member: member('owner') }).status).toBe('ok');
  });
});
