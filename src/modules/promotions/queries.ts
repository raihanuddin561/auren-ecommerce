import { db } from '@/lib/db';
import { money, serialize } from '@/lib/money';
import type { CartIdentity } from '@/modules/cart/types';
import * as repo from './repository';
import * as service from './service';
import type { DiscountRecord, DiscountSummaryView } from './types';

export async function getDiscountsForAdmin(
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'active' | 'inactive';
  } = {},
): Promise<{
  items: DiscountRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return repo.listDiscountsForAdmin(db, options);
}

export async function getDiscountDetailForAdmin(id: string): Promise<DiscountRecord | null> {
  return repo.findDiscountById(db, id);
}

export async function getCartAppliedDiscount(
  identity: CartIdentity,
): Promise<DiscountSummaryView | null> {
  const code = await service.getCartDiscountCode(identity);
  if (!code) return null;

  const discount = await repo.findDiscountByCode(db, code);
  if (!discount || !discount.isActive) return null;

  return {
    code: discount.code ?? '',
    title: discount.title,
    type: discount.type,
    amount: serialize(
      money(
        discount.type === 'fixed_amount' ? BigInt(Math.round(discount.value * 100)) : 0n,
        'BDT',
      ),
    ),
    freeShipping: discount.type === 'free_shipping',
  };
}
