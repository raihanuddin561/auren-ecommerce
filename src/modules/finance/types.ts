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

// ---------------------------------------------------------------------------------------------
// Expense Categories (11.1)
// ---------------------------------------------------------------------------------------------

export type ExpenseCategoryType =
  | 'marketing'
  | 'payroll'
  | 'rent'
  | 'utilities'
  | 'software'
  | 'photography'
  | 'packaging_stock'
  | 'logistics'
  | 'professional_fees'
  | 'bank_charges'
  | 'misc';

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  type: ExpenseCategoryType;
  isCogs: boolean;
  description: string | null;
  expenseCount: number;
  totalSpentFormatted: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------
// Marketing Campaigns (11.4)
// ---------------------------------------------------------------------------------------------

export type MarketingCampaignChannel =
  'meta' | 'google' | 'tiktok' | 'influencer' | 'email' | 'offline';

export interface MarketingCampaignItem {
  id: string;
  name: string;
  channel: MarketingCampaignChannel;
  utmCampaign: string | null;
  startsOn: string;
  endsOn: string | null;
  budgetFormatted: string;
  spendFormatted: string;
  attributedOrdersCount: number;
  attributedRevenueFormatted: string;
  roas: string | null; // e.g. "4.2x"
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------
// Recurring Expenses (11.3)
// ---------------------------------------------------------------------------------------------

export type RecurringExpenseCadence = 'monthly' | 'weekly' | 'yearly';

export interface RecurringExpenseItem {
  id: string;
  categoryId: string;
  categoryName: string;
  vendor: string;
  amountFormatted: string;
  amountMinor: string;
  currency: string;
  cadence: RecurringExpenseCadence;
  dayOfPeriod: number;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------
// Expense Entries (11.2)
// ---------------------------------------------------------------------------------------------

export interface ExpenseListItem {
  id: string;
  expenseDate: string; // YYYY-MM-DD
  categoryId: string;
  categoryName: string;
  categoryType: ExpenseCategoryType;
  isCogs: boolean;
  campaignId: string | null;
  campaignName: string | null;
  recurringExpenseId: string | null;
  vendor: string;
  description: string;
  amountFormatted: string;
  amountMinor: string;
  currency: string;
  paymentMethod: string;
  reference: string | null;
  attachmentUrl: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ExpenseFilterParams {
  categoryId?: string;
  campaignId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ExpenseListResult {
  items: ExpenseListItem[];
  totalCount: number;
  totalSumFormatted: string;
  nextCursor?: string;
}

// ---------------------------------------------------------------------------------------------
// Profit & Loss Report (11.8)
// ---------------------------------------------------------------------------------------------

export type PAndLRecognitionMode = 'placed' | 'delivered';
export type PAndLGrouping = 'day' | 'week' | 'month';

export interface PAndLPeriodFigures {
  grossSalesFormatted: string;
  discountsFormatted: string;
  refundsFormatted: string;
  netSalesFormatted: string;
  cogsFormatted: string;
  grossProfitFormatted: string;
  grossMarginPercent: string; // e.g. "64.2%"
  // Direct variable order fulfillment costs
  shippingChargedFormatted: string;
  shippingCostFormatted: string;
  gatewayFeesFormatted: string;
  codFeesFormatted: string;
  packagingFormatted: string;
  returnsAndRtoCostFormatted: string;
  contributionMarginFormatted: string;
  contributionMarginPercent: string;
  // Operating Expenses (OpEx)
  marketingSpendFormatted: string;
  payrollFormatted: string;
  rentFormatted: string;
  utilitiesFormatted: string;
  softwareFormatted: string;
  otherOpexFormatted: string;
  totalOpexFormatted: string;
  // Bottom line
  netProfitFormatted: string;
  netMarginPercent: string;
}

export interface PAndLRowItem {
  periodKey: string; // e.g. "2026-10", "2026-W40", "2026-10-09"
  label: string;
  ordersCount: number;
  figures: PAndLPeriodFigures;
}

export interface ProfitAndLossReport {
  recognitionMode: PAndLRecognitionMode;
  dateFrom: string;
  dateTo: string;
  summary: PAndLPeriodFigures;
  breakdown: PAndLRowItem[];
}

// ---------------------------------------------------------------------------------------------
// Product Profitability (11.9)
// ---------------------------------------------------------------------------------------------

export interface ProductProfitabilityRow {
  productId: string;
  productTitle: string;
  productType: string;
  categoryName: string;
  thumbnailUrl: string | null;
  unitsSold: number;
  unitsReturned: number;
  returnRatePercent: string; // e.g. "3.5%"
  grossRevenueFormatted: string;
  cogsFormatted: string;
  grossProfitFormatted: string;
  grossMarginPercent: string; // e.g. "68.4%"
}

// ---------------------------------------------------------------------------------------------
// Finance Executive Overview
// ---------------------------------------------------------------------------------------------

export interface FinanceOverviewMetrics {
  currentMonthNetSales: string;
  currentMonthGrossProfit: string;
  currentMonthGrossMarginPercent: string;
  currentMonthTotalExpenses: string;
  currentMonthNetProfit: string;
  currentMonthNetMarginPercent: string;
  activeCampaignsCount: number;
  monthlyRecurringSpend: string;
}
