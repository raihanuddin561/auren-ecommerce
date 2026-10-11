export type AnalyticsTimeRange = '7d' | '30d' | '90d' | '12m' | 'all';

export interface SalesKpiSummary {
  netSalesMinor: bigint;
  netSalesFormatted: string;
  ordersCount: number;
  unitsSold: number;
  aovMinor: bigint;
  aovFormatted: string;
  deliveredSalesMinor: bigint;
  deliveredSalesFormatted: string;
  previousNetSalesMinor: bigint;
  netSalesGrowthPercent: number;
  ordersGrowthPercent: number;
}

export interface DailySalesTrendPoint {
  date: string;
  netSalesMinor: bigint;
  netSalesFormatted: string;
  ordersCount: number;
  unitsSold: number;
}

export interface ChannelBreakdown {
  channel: string;
  channelLabel: string;
  ordersCount: number;
  revenueMinor: bigint;
  revenueFormatted: string;
  percentage: number;
}

export interface CategorySalesContribution {
  categoryId: string;
  categoryName: string;
  revenueMinor: bigint;
  revenueFormatted: string;
  unitsSold: number;
  percentage: number;
}

export interface TopSellingProduct {
  productId: string;
  title: string;
  unitsSold: number;
  revenueMinor: bigint;
  revenueFormatted: string;
  cogsMinor: bigint;
  grossMarginPercent: number;
}

export interface CustomerAnalytics {
  newCustomersCount: number;
  returningCustomersCount: number;
  repeatCustomerRatePercent: number;
  newCustomerRevenueMinor: bigint;
  returningCustomerRevenueMinor: bigint;
  newCustomerRevenueFormatted: string;
  returningCustomerRevenueFormatted: string;
}

export interface OrderFunnelMetrics {
  placed: number;
  verified: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  returned: number;
  verificationRatePercent: number;
  fulfillmentRatePercent: number;
  deliverySuccessRatePercent: number;
}

export interface VerificationStaffPerformance {
  staffId: string;
  staffName: string;
  role: string;
  totalAttempts: number;
  ordersConfirmed: number;
  ordersCancelled: number;
  medianMinutesToVerify: number;
  slaMetPercent: number;
}

export interface VerificationOutcomeBreakdown {
  outcome: string;
  label: string;
  count: number;
  percentage: number;
}

export interface VerificationChannelBreakdown {
  channel: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CancelReasonBreakdown {
  reason: string;
  count: number;
  percentage: number;
}

export interface VerificationPerformanceReport {
  totalAttempts: number;
  ordersVerified: number;
  ordersCancelled: number;
  medianMinutesToVerify: number;
  slaCompliancePercent: number;
  outcomeBreakdown: VerificationOutcomeBreakdown[];
  channelBreakdown: VerificationChannelBreakdown[];
  cancelReasonBreakdown: CancelReasonBreakdown[];
  staffScoreboard: VerificationStaffPerformance[];
}

export interface AnalyticsOverview {
  timeRange: AnalyticsTimeRange;
  kpis: SalesKpiSummary;
  trends: DailySalesTrendPoint[];
  channels: ChannelBreakdown[];
  categories: CategorySalesContribution[];
  topProducts: TopSellingProduct[];
  customers: CustomerAnalytics;
  funnel: OrderFunnelMetrics;
  verification: VerificationPerformanceReport;
}
