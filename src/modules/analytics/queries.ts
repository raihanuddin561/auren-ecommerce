import 'server-only';
import { db } from '@/lib/db';
import { format, money } from '@/lib/money';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import * as repo from './repository';
import type { AnalyticsRange } from './schemas';
import type { AnalyticsOverview } from './types';

function formatBdt(minor: bigint): string {
  return format(money(minor, 'BDT'), { trimZeroFraction: true });
}

export async function getAnalyticsOverviewQuery(
  range: AnalyticsRange = '30d',
): Promise<AnalyticsOverview> {
  const staff = await requireStaff();
  assertPermission(staff, 'analytics.read');

  const bounds = repo.getDateRangeBounds(range);
  const { currentStart, end } = bounds;

  const [
    rawKpis,
    rawTrends,
    rawChannels,
    rawCategories,
    rawTopProducts,
    rawCustomers,
    rawFunnel,
    rawVerification,
  ] = await Promise.all([
    repo.aggregateSalesKpis(db, bounds),
    repo.aggregateDailyTrends(db, currentStart, end),
    repo.aggregateSalesByChannel(db, currentStart, end),
    repo.aggregateCategorySales(db, currentStart, end),
    repo.aggregateTopSellingProducts(db, currentStart, end, 10),
    repo.aggregateCustomerMetrics(db, currentStart, end),
    repo.aggregateOrderFunnel(db, currentStart, end),
    repo.aggregateVerificationReport(db, currentStart, end),
  ]);

  const kpis = {
    ...rawKpis,
    netSalesFormatted: formatBdt(rawKpis.netSalesMinor),
    aovFormatted: formatBdt(rawKpis.aovMinor),
    deliveredSalesFormatted: formatBdt(rawKpis.deliveredSalesMinor),
  };

  const trends = rawTrends.map((t) => ({
    ...t,
    netSalesFormatted: formatBdt(t.netSalesMinor),
  }));

  const channels = rawChannels.map((c) => ({
    ...c,
    revenueFormatted: formatBdt(c.revenueMinor),
  }));

  const categories = rawCategories.map((c) => ({
    ...c,
    revenueFormatted: formatBdt(c.revenueMinor),
  }));

  const topProducts = rawTopProducts.map((p) => ({
    ...p,
    revenueFormatted: formatBdt(p.revenueMinor),
  }));

  const customers = {
    ...rawCustomers,
    newCustomerRevenueFormatted: formatBdt(rawCustomers.newCustomerRevenueMinor),
    returningCustomerRevenueFormatted: formatBdt(rawCustomers.returningCustomerRevenueMinor),
  };

  return {
    timeRange: range,
    kpis,
    trends,
    channels,
    categories,
    topProducts,
    customers,
    funnel: rawFunnel,
    verification: rawVerification,
  };
}
