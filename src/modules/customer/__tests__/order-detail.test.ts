import { describe, expect, it } from 'vitest';
import { findCustomerOrderById } from '../repository';
import type { Tx } from '@/lib/db';

interface CapturedOrderQuery {
  where: {
    AND: Array<{
      OR: Array<Record<string, unknown>>;
    }>;
  };
}

describe('Customer Order Detail Repository', () => {
  it('queries an order with ownership checks matching userId', async () => {
    let capturedQuery: CapturedOrderQuery | null = null;

    const mockTx = {
      user: {
        findUnique: async () => ({
          email: 'client@auren.atelier',
          phone: '+8801700000001',
        }),
      },
      order: {
        findFirst: async (args: CapturedOrderQuery) => {
          capturedQuery = args;
          return {
            id: 'ord-123',
            orderNumber: 'AUR-100001',
            status: 'confirmed',
            totalMinor: 1850000n,
            currency: 'BDT',
            items: [],
            events: [],
            payments: [],
            shipments: [],
          };
        },
      },
    } as unknown as Tx;

    const result = await findCustomerOrderById(mockTx, 'usr-1', 'AUR-100001');

    expect(result).not.toBeNull();
    expect(result?.orderNumber).toBe('AUR-100001');
    const query1 = capturedQuery as unknown as CapturedOrderQuery;
    expect(query1.where.AND[0]?.OR).toEqual([{ id: 'AUR-100001' }, { orderNumber: 'AUR-100001' }]);
    expect(query1.where.AND[1]?.OR).toEqual([
      { userId: 'usr-1' },
      { email: 'client@auren.atelier' },
      { phone: '+8801700000001' },
    ]);
  });

  it('queries order by id when provided UUID', async () => {
    let capturedQuery: CapturedOrderQuery | null = null;

    const mockTx = {
      user: {
        findUnique: async () => ({
          email: 'client@auren.atelier',
          phone: null,
        }),
      },
      order: {
        findFirst: async (args: CapturedOrderQuery) => {
          capturedQuery = args;
          return {
            id: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e',
            orderNumber: 'AUR-100002',
          };
        },
      },
    } as unknown as Tx;

    const result = await findCustomerOrderById(
      mockTx,
      'usr-2',
      '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e',
    );

    expect(result).not.toBeNull();
    const query2 = capturedQuery as unknown as CapturedOrderQuery;
    expect(query2.where.AND[0]?.OR).toEqual([
      { id: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e' },
      { orderNumber: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e' },
    ]);
    // Phone was null, so only userId and email are in OR
    expect(query2.where.AND[1]?.OR).toEqual([
      { userId: 'usr-2' },
      { email: 'client@auren.atelier' },
    ]);
  });
});
