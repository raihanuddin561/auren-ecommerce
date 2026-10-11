import type { Tx } from '@/lib/db';
import type { AnalyticsRange } from './schemas';
import type {
  CancelReasonBreakdown,
  CategorySalesContribution,
  ChannelBreakdown,
  CustomerAnalytics,
  DailySalesTrendPoint,
  OrderFunnelMetrics,
  SalesKpiSummary,
  TopSellingProduct,
  VerificationChannelBreakdown,
  VerificationOutcomeBreakdown,
  VerificationPerformanceReport,
  VerificationStaffPerformance,
} from './types';

const SLA_TARGET_MINUTES = 120;

export function getDateRangeBounds(range: AnalyticsRange): {
  currentStart: Date;
  previousStart: Date;
  end: Date;
} {
  const end = new Date();
  let days = 30;

  switch (range) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '12m':
      days = 365;
      break;
    case 'all':
      days = 3650;
      break;
  }

  const currentStart = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

  return { currentStart, previousStart, end };
}

export async function aggregateSalesKpis(
  tx: Tx,
  bounds: { currentStart: Date; previousStart: Date; end: Date },
): Promise<SalesKpiSummary> {
  const { currentStart, previousStart, end } = bounds;

  const [currentOrders, deliveredAggregate, previousOrders, itemsSum] = await Promise.all([
    tx.order.aggregate({
      where: {
        placedAt: { gte: currentStart, lte: end },
        status: { not: 'cancelled' },
      },
      _sum: { totalMinor: true },
      _count: true,
    }),
    tx.order.aggregate({
      where: {
        placedAt: { gte: currentStart, lte: end },
        status: { in: ['delivered', 'completed'] },
      },
      _sum: { totalMinor: true },
    }),
    tx.order.aggregate({
      where: {
        placedAt: { gte: previousStart, lt: currentStart },
        status: { not: 'cancelled' },
      },
      _sum: { totalMinor: true },
      _count: true,
    }),
    tx.orderItem.aggregate({
      where: {
        order: {
          placedAt: { gte: currentStart, lte: end },
          status: { not: 'cancelled' },
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  const netSalesMinor = currentOrders._sum.totalMinor ?? 0n;
  const ordersCount = currentOrders._count ?? 0;
  const unitsSold = itemsSum._sum.quantity ?? 0;
  const deliveredSalesMinor = deliveredAggregate._sum.totalMinor ?? 0n;
  const previousNetSalesMinor = previousOrders._sum.totalMinor ?? 0n;
  const previousOrdersCount = previousOrders._count ?? 0;

  const aovMinor = ordersCount > 0 ? netSalesMinor / BigInt(ordersCount) : 0n;

  const netSalesGrowthPercent =
    previousNetSalesMinor > 0n
      ? Number(((netSalesMinor - previousNetSalesMinor) * 10000n) / previousNetSalesMinor) / 100
      : netSalesMinor > 0n
        ? 100
        : 0;

  const ordersGrowthPercent =
    previousOrdersCount > 0
      ? Math.round(((ordersCount - previousOrdersCount) / previousOrdersCount) * 1000) / 10
      : ordersCount > 0
        ? 100
        : 0;

  return {
    netSalesMinor,
    netSalesFormatted: '',
    ordersCount,
    unitsSold,
    aovMinor,
    aovFormatted: '',
    deliveredSalesMinor,
    deliveredSalesFormatted: '',
    previousNetSalesMinor,
    netSalesGrowthPercent,
    ordersGrowthPercent,
  };
}

export async function aggregateDailyTrends(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<DailySalesTrendPoint[]> {
  const orders = await tx.order.findMany({
    where: {
      placedAt: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    select: {
      placedAt: true,
      totalMinor: true,
      items: {
        select: {
          quantity: true,
        },
      },
    },
    orderBy: { placedAt: 'asc' },
  });

  const buckets = new Map<
    string,
    { netSalesMinor: bigint; ordersCount: number; unitsSold: number }
  >();

  for (const order of orders) {
    const key = order.placedAt.toISOString().slice(0, 10);
    const existing = buckets.get(key) ?? {
      netSalesMinor: 0n,
      ordersCount: 0,
      unitsSold: 0,
    };
    const orderUnits = order.items.reduce((acc, it) => acc + it.quantity, 0);

    buckets.set(key, {
      netSalesMinor: existing.netSalesMinor + order.totalMinor,
      ordersCount: existing.ordersCount + 1,
      unitsSold: existing.unitsSold + orderUnits,
    });
  }

  return Array.from(buckets.entries()).map(([date, data]) => ({
    date,
    netSalesMinor: data.netSalesMinor,
    netSalesFormatted: '',
    ordersCount: data.ordersCount,
    unitsSold: data.unitsSold,
  }));
}

export async function aggregateSalesByChannel(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<ChannelBreakdown[]> {
  const grouped = await tx.order.groupBy({
    by: ['channel'],
    where: {
      placedAt: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    _sum: { totalMinor: true },
    _count: true,
  });

  const totalRevenue = grouped.reduce((acc, g) => acc + (g._sum.totalMinor ?? 0n), 0n);

  const channelLabels: Record<string, string> = {
    web: 'Online Boutique',
    phone: 'Phone & Direct',
    pos: 'Atelier Studio POS',
  };

  return grouped.map((g) => {
    const revenueMinor = g._sum.totalMinor ?? 0n;
    const percentage =
      totalRevenue > 0n ? Math.round(Number((revenueMinor * 1000n) / totalRevenue)) / 10 : 0;

    return {
      channel: g.channel,
      channelLabel: channelLabels[g.channel] ?? g.channel,
      ordersCount: g._count,
      revenueMinor,
      revenueFormatted: '',
      percentage,
    };
  });
}

export async function aggregateCategorySales(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<CategorySalesContribution[]> {
  const items = await tx.orderItem.findMany({
    where: {
      order: {
        placedAt: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
    },
    select: {
      totalMinor: true,
      quantity: true,
      variant: {
        select: {
          product: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const categoryMap = new Map<
    string,
    { categoryName: string; revenueMinor: bigint; unitsSold: number }
  >();
  let totalRevenue = 0n;

  for (const item of items) {
    const category = item.variant.product.category;
    const catId = category?.id ?? 'uncategorized';
    const catName = category?.name ?? 'General Collection';

    const curr = categoryMap.get(catId) ?? {
      categoryName: catName,
      revenueMinor: 0n,
      unitsSold: 0,
    };

    categoryMap.set(catId, {
      categoryName: catName,
      revenueMinor: curr.revenueMinor + item.totalMinor,
      unitsSold: curr.unitsSold + item.quantity,
    });

    totalRevenue += item.totalMinor;
  }

  const result: CategorySalesContribution[] = [];

  for (const [categoryId, data] of categoryMap.entries()) {
    const percentage =
      totalRevenue > 0n ? Math.round(Number((data.revenueMinor * 1000n) / totalRevenue)) / 10 : 0;

    result.push({
      categoryId,
      categoryName: data.categoryName,
      revenueMinor: data.revenueMinor,
      revenueFormatted: '',
      unitsSold: data.unitsSold,
      percentage,
    });
  }

  return result.sort((a, b) => (b.revenueMinor > a.revenueMinor ? 1 : -1));
}

export async function aggregateTopSellingProducts(
  tx: Tx,
  start: Date,
  end: Date,
  limit = 10,
): Promise<TopSellingProduct[]> {
  const items = await tx.orderItem.findMany({
    where: {
      order: {
        placedAt: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
    },
    select: {
      productId: true,
      titleSnapshot: true,
      quantity: true,
      totalMinor: true,
      unitCostMinor: true,
    },
  });

  const productMap = new Map<
    string,
    { title: string; unitsSold: number; revenueMinor: bigint; cogsMinor: bigint }
  >();

  for (const item of items) {
    const curr = productMap.get(item.productId) ?? {
      title: item.titleSnapshot,
      unitsSold: 0,
      revenueMinor: 0n,
      cogsMinor: 0n,
    };

    const cost = item.unitCostMinor * BigInt(item.quantity);

    productMap.set(item.productId, {
      title: curr.title || item.titleSnapshot,
      unitsSold: curr.unitsSold + item.quantity,
      revenueMinor: curr.revenueMinor + item.totalMinor,
      cogsMinor: curr.cogsMinor + cost,
    });
  }

  const sorted = Array.from(productMap.entries())
    .map(([productId, val]) => {
      const marginMinor = val.revenueMinor - val.cogsMinor;
      const grossMarginPercent =
        val.revenueMinor > 0n
          ? Math.round(Number((marginMinor * 1000n) / val.revenueMinor)) / 10
          : 0;

      return {
        productId,
        title: val.title,
        unitsSold: val.unitsSold,
        revenueMinor: val.revenueMinor,
        revenueFormatted: '',
        cogsMinor: val.cogsMinor,
        grossMarginPercent,
      };
    })
    .sort((a, b) => (b.revenueMinor > a.revenueMinor ? 1 : -1))
    .slice(0, limit);

  return sorted;
}

export async function aggregateCustomerMetrics(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<CustomerAnalytics> {
  const periodOrders = await tx.order.findMany({
    where: {
      placedAt: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    select: {
      userId: true,
      phone: true,
      totalMinor: true,
    },
  });

  let newCustomersCount = 0;
  let returningCustomersCount = 0;
  let newCustomerRevenueMinor = 0n;
  let returningCustomerRevenueMinor = 0n;

  const seenCustomers = new Set<string>();

  for (const order of periodOrders) {
    const identifier = order.userId ?? order.phone;
    if (seenCustomers.has(identifier)) {
      returningCustomerRevenueMinor += order.totalMinor;
      continue;
    }
    seenCustomers.add(identifier);

    // Check if customer had orders prior to this period start
    const priorCount = await tx.order.count({
      where: {
        placedAt: { lt: start },
        status: { not: 'cancelled' },
        ...(order.userId ? { userId: order.userId } : { phone: order.phone }),
      },
    });

    if (priorCount > 0) {
      returningCustomersCount++;
      returningCustomerRevenueMinor += order.totalMinor;
    } else {
      newCustomersCount++;
      newCustomerRevenueMinor += order.totalMinor;
    }
  }

  const totalClients = newCustomersCount + returningCustomersCount;
  const repeatCustomerRatePercent =
    totalClients > 0 ? Math.round((returningCustomersCount / totalClients) * 1000) / 10 : 0;

  return {
    newCustomersCount,
    returningCustomersCount,
    repeatCustomerRatePercent,
    newCustomerRevenueMinor,
    returningCustomerRevenueMinor,
    newCustomerRevenueFormatted: '',
    returningCustomerRevenueFormatted: '',
  };
}

export async function aggregateOrderFunnel(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<OrderFunnelMetrics> {
  const orders = await tx.order.findMany({
    where: {
      placedAt: { gte: start, lte: end },
    },
    select: {
      status: true,
    },
  });

  const placed = orders.length;
  let verified = 0;
  let dispatched = 0;
  let delivered = 0;
  let cancelled = 0;
  let returned = 0;

  for (const o of orders) {
    if (o.status === 'cancelled') {
      cancelled++;
      continue;
    }

    if (
      [
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'delivery_failed',
        'returned_to_origin',
        'completed',
        'return_requested',
        'returned',
        'refunded',
        'exchanged',
      ].includes(o.status)
    ) {
      verified++;
    }

    if (
      [
        'shipped',
        'delivered',
        'delivery_failed',
        'returned_to_origin',
        'completed',
        'return_requested',
        'returned',
        'refunded',
        'exchanged',
      ].includes(o.status)
    ) {
      dispatched++;
    }

    if (['delivered', 'completed'].includes(o.status)) {
      delivered++;
    }

    if (
      ['return_requested', 'returned', 'refunded', 'exchanged', 'returned_to_origin'].includes(
        o.status,
      )
    ) {
      returned++;
    }
  }

  const verificationRatePercent = placed > 0 ? Math.round((verified / placed) * 1000) / 10 : 0;
  const fulfillmentRatePercent = verified > 0 ? Math.round((dispatched / verified) * 1000) / 10 : 0;
  const deliverySuccessRatePercent =
    dispatched > 0 ? Math.round((delivered / dispatched) * 1000) / 10 : 0;

  return {
    placed,
    verified,
    dispatched,
    delivered,
    cancelled,
    returned,
    verificationRatePercent,
    fulfillmentRatePercent,
    deliverySuccessRatePercent,
  };
}

const CONF_AT = 'confirmedAt' as const;
const CONF_BY = 'confirmedBy' as const;
const CANC_AT = 'cancelledAt' as const;
const CANC_BY = 'cancelledBy' as const;

export async function aggregateVerificationReport(
  tx: Tx,
  start: Date,
  end: Date,
): Promise<VerificationPerformanceReport> {
  const [attempts, verifiedOrders, cancelledOrders] = await Promise.all([
    tx.orderVerificationAttempt.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        outcome: true,
        channel: true,
        staffId: true,
        staff: {
          select: {
            id: true,
            role: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    tx.order.findMany({
      where: {
        [CONF_AT]: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        placedAt: true,
        [CONF_AT]: true,
        [CONF_BY]: true,
      },
    }),
    tx.order.findMany({
      where: {
        [CANC_AT]: { gte: start, lte: end },
        status: 'cancelled',
      },
      select: {
        cancelReason: true,
        [CANC_BY]: true,
      },
    }),
  ]);

  const totalAttempts = attempts.length;
  const ordersVerified = verifiedOrders.length;
  const ordersCancelled = cancelledOrders.length;

  // Outcome breakdown
  const outcomeCounts = new Map<string, number>();
  for (const a of attempts) {
    outcomeCounts.set(a.outcome, (outcomeCounts.get(a.outcome) ?? 0) + 1);
  }

  const outcomeLabels: Record<string, string> = {
    verified: 'Client Confirmed',
    no_answer: 'No Answer / Unreachable',
    busy: 'Line Busy',
    wrong_number: 'Incorrect Phone Number',
    callback_requested: 'Callback Scheduled',
    customer_cancelled: 'Client Requested Cancel',
    suspected_fake: 'Suspected Fraud / Fake',
    order_edited: 'Garment Specification Edited',
  };

  const outcomeBreakdown: VerificationOutcomeBreakdown[] = Array.from(outcomeCounts.entries()).map(
    ([outcome, count]) => ({
      outcome,
      label: outcomeLabels[outcome] ?? outcome,
      count,
      percentage: totalAttempts > 0 ? Math.round((count / totalAttempts) * 1000) / 10 : 0,
    }),
  );

  // Channel breakdown
  const channelCounts = new Map<string, number>();
  for (const a of attempts) {
    channelCounts.set(a.channel, (channelCounts.get(a.channel) ?? 0) + 1);
  }

  const channelLabels: Record<string, string> = {
    call: 'Direct Atelier Call',
    sms: 'SMS Verification',
    whatsapp: 'WhatsApp Concierge',
    messenger: 'Social Messenger',
  };

  const channelBreakdown: VerificationChannelBreakdown[] = Array.from(channelCounts.entries()).map(
    ([channel, count]) => ({
      channel,
      label: channelLabels[channel] ?? channel,
      count,
      percentage: totalAttempts > 0 ? Math.round((count / totalAttempts) * 1000) / 10 : 0,
    }),
  );

  // Cancel reasons breakdown
  const cancelCounts = new Map<string, number>();
  for (const c of cancelledOrders) {
    const reason = c.cancelReason || 'Unspecified / Client Change of Mind';
    cancelCounts.set(reason, (cancelCounts.get(reason) ?? 0) + 1);
  }

  const cancelReasonBreakdown: CancelReasonBreakdown[] = Array.from(cancelCounts.entries()).map(
    ([reason, count]) => ({
      reason,
      count,
      percentage: ordersCancelled > 0 ? Math.round((count / ordersCancelled) * 1000) / 10 : 0,
    }),
  );

  // SLA and duration
  const verificationDurationsMinutes: number[] = [];
  let metSlaCount = 0;

  for (const o of verifiedOrders) {
    if (o.confirmedAt && o.placedAt) {
      const minutes = Math.max(
        0,
        Math.round((o.confirmedAt.getTime() - o.placedAt.getTime()) / (60 * 1000)),
      );
      verificationDurationsMinutes.push(minutes);
      if (minutes <= SLA_TARGET_MINUTES) {
        metSlaCount++;
      }
    }
  }

  verificationDurationsMinutes.sort((a, b) => a - b);
  const medianMinutesToVerify =
    verificationDurationsMinutes.length > 0
      ? (verificationDurationsMinutes[Math.floor(verificationDurationsMinutes.length / 2)] ?? 0)
      : 0;

  const slaCompliancePercent =
    verifiedOrders.length > 0 ? Math.round((metSlaCount / verifiedOrders.length) * 1000) / 10 : 100;

  // Staff Scoreboard
  const staffStats = new Map<
    string,
    {
      staffName: string;
      role: string;
      attempts: number;
      confirmed: number;
      cancelled: number;
      durations: number[];
      metSla: number;
    }
  >();

  for (const a of attempts) {
    const entry = staffStats.get(a.staffId) ?? {
      staffName: a.staff.user.name,
      role: a.staff.role,
      attempts: 0,
      confirmed: 0,
      cancelled: 0,
      durations: [],
      metSla: 0,
    };
    entry.attempts++;
    staffStats.set(a.staffId, entry);
  }

  for (const o of verifiedOrders) {
    if (o.confirmedBy && staffStats.has(o.confirmedBy)) {
      const entry = staffStats.get(o.confirmedBy)!;
      entry.confirmed++;
      if (o.confirmedAt && o.placedAt) {
        const mins = Math.max(
          0,
          Math.round((o.confirmedAt.getTime() - o.placedAt.getTime()) / (60 * 1000)),
        );
        entry.durations.push(mins);
        if (mins <= SLA_TARGET_MINUTES) {
          entry.metSla++;
        }
      }
    }
  }

  for (const c of cancelledOrders) {
    if (c.cancelledBy && staffStats.has(c.cancelledBy)) {
      staffStats.get(c.cancelledBy)!.cancelled++;
    }
  }

  const staffScoreboard: VerificationStaffPerformance[] = Array.from(staffStats.entries()).map(
    ([staffId, s]) => {
      s.durations.sort((a, b) => a - b);
      const median =
        s.durations.length > 0 ? (s.durations[Math.floor(s.durations.length / 2)] ?? 0) : 0;
      const slaMet = s.confirmed > 0 ? Math.round((s.metSla / s.confirmed) * 1000) / 10 : 100;

      return {
        staffId,
        staffName: s.staffName,
        role: s.role,
        totalAttempts: s.attempts,
        ordersConfirmed: s.confirmed,
        ordersCancelled: s.cancelled,
        medianMinutesToVerify: median,
        slaMetPercent: slaMet,
      };
    },
  );

  return {
    totalAttempts,
    ordersVerified,
    ordersCancelled,
    medianMinutesToVerify,
    slaCompliancePercent,
    outcomeBreakdown,
    channelBreakdown,
    cancelReasonBreakdown,
    staffScoreboard,
  };
}
