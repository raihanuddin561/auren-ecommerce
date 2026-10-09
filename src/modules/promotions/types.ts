import type { SerializedMoney } from '@/lib/money';
import type {
  DiscountAppliesTo,
  DiscountCustomerEligibility,
  DiscountType,
} from '@/generated/prisma/client';

export type { DiscountAppliesTo, DiscountCustomerEligibility, DiscountType };

export interface DiscountRecord {
  id: string;
  code: string | null;
  title: string;
  type: DiscountType;
  value: number; // For percentage: e.g. 15 for 15%; For fixed_amount: amount in BDT decimal
  appliesTo: DiscountAppliesTo;
  targetIds: string[];
  minSubtotalMinor: bigint | null;
  minQuantity: number | null;
  maxDiscountMinor: bigint | null;
  customerEligibility: DiscountCustomerEligibility;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  combinable: boolean;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineForDiscount {
  variantId: string;
  productId: string;
  collectionIds?: string[];
  categoryId?: string | null;
  unitPriceMinor: bigint;
  quantity: number;
  currency: string;
}

export interface DiscountEvaluationContext {
  userId?: string | null;
  phone?: string | null;
  shippingChargeMinor?: bigint;
  now?: Date;
}

export interface EvaluatedDiscountLine {
  variantId: string;
  discountMinor: bigint;
  totalMinor: bigint;
}

export interface EvaluatedDiscount {
  id: string;
  code: string | null;
  title: string;
  type: DiscountType;
  discountMinor: bigint;
  freeShipping: boolean;
  lines: EvaluatedDiscountLine[];
}

export interface DiscountSummaryView {
  code: string;
  title: string;
  type: DiscountType;
  amount: SerializedMoney;
  freeShipping: boolean;
}
