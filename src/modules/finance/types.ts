import type { SerializedMoney } from '@/lib/money';

/** The kinds of cost an order can carry besides its goods (11.5). */
export type CostType =
  'shipping' | 'gateway_fee' | 'cod_fee' | 'packaging' | 'return_shipping' | 'rto_loss' | 'other';

/** The order profit breakdown as the admin order page shows it (11.6). */
export interface OrderProfitView {
  recognised: boolean;
  currency: string;
  figures: Record<
    | 'grossSales'
    | 'discounts'
    | 'refunds'
    | 'netSales'
    | 'cogs'
    | 'grossProfit'
    | 'shippingCharged'
    | 'shippingCost'
    | 'gatewayFees'
    | 'codFees'
    | 'packaging'
    | 'returnCosts'
    | 'otherCosts'
    | 'contributionMargin',
    SerializedMoney
  >;
  marginBps: string | null;
  costLines: Array<{
    type: CostType;
    amount: SerializedMoney;
    note: string | null;
    createdAt: string;
  }>;
}
