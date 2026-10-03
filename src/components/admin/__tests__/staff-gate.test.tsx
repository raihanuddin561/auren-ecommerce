import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';

const { requireStaff, notFound } = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/staff', () => ({ requireStaff }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('../shell/admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));

import { StaffGate } from '../shell/staff-gate';

describe('console staff gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers 404 (notFound) to a signed-in customer', async () => {
    requireStaff.mockRejectedValue(new DomainError('FORBIDDEN'));
    await expect(StaffGate({ children: 'console' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireStaff).toHaveBeenCalledTimes(1);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('does not hide other failures behind a 404', async () => {
    requireStaff.mockRejectedValue(new Error('database down'));
    await expect(StaffGate({ children: 'console' })).rejects.toThrow('database down');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('renders the console for staff', async () => {
    requireStaff.mockResolvedValue({
      name: 'A',
      email: 'a@auren.test',
      role: 'owner',
      permissions: new Set(['orders.verify']),
    });
    const element = await StaffGate({ children: 'console' });
    expect(renderToStaticMarkup(element)).toContain('console');
    expect(notFound).not.toHaveBeenCalled();
  });
});
