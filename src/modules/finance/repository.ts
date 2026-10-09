import { randomUUID } from 'node:crypto';
import type { Tx } from '@/lib/db';
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateMarketingCampaignInput,
  CreateRecurringExpenseInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateMarketingCampaignInput,
  UpdateRecurringExpenseInput,
} from './schemas';
import type { CostType, ExpenseFilterParams, PAndLRecognitionMode } from './types';

export type { CostType };

export interface CostLineInsert {
  orderId: string;
  type: CostType;
  amountMinor: bigint;
  currency: string;
  sourceType?: string | null;
  sourceId?: string | null;
  note?: string | null;
  actorId?: string | null;
}

/**
 * Inserts a cost line. A line with a source is recorded once: the unique index on
 * (order, type, source type, source id) makes a second call a no-op. Returns whether it was written.
 */
export async function insertCostLine(tx: Tx, line: CostLineInsert): Promise<boolean> {
  const id = randomUUID();
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO order_cost_lines
      (id, order_id, type, amount_minor, currency, source_type, source_id, note, actor_id)
    VALUES
      (${id}::uuid, ${line.orderId}::uuid, ${line.type}::order_cost_type, ${line.amountMinor},
       ${line.currency}, ${line.sourceType ?? null}, ${line.sourceId ?? null},
       ${line.note ?? null}, ${line.actorId ?? null}::uuid)
    ON CONFLICT (order_id, type, source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
    RETURNING id`;
  return rows.length === 1;
}

export const listCostLines = (tx: Tx, orderId: string) =>
  tx.orderCostLine.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

/** What is already booked for one source (for example a parcel), summed per type. */
export async function sumCostBySource(
  tx: Tx,
  orderId: string,
  type: CostType,
  sourceType: string,
  sourceIdPrefix: string,
): Promise<bigint> {
  const rows = await tx.$queryRaw<Array<{ total: bigint | null }>>`
    SELECT SUM(amount_minor)::bigint AS total FROM order_cost_lines
     WHERE order_id = ${orderId}::uuid AND type = ${type}::order_cost_type
       AND source_type = ${sourceType} AND (source_id = ${sourceIdPrefix}
            OR source_id LIKE ${sourceIdPrefix + ':%'})`;
  return rows[0]?.total ?? 0n;
}

export async function orderForProfit(tx: Tx, orderId: string) {
  return tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      currency: true,
      discountMinor: true,
      shippingChargedMinor: true,
      refundedMinor: true,
      deliveredAt: true,
      items: {
        select: {
          id: true,
          variantId: true,
          quantity: true,
          unitPriceMinor: true,
          unitCostMinor: true,
          discountMinor: true,
        },
      },
    },
  });
}

/** Units that came back resellable, per order line. */
export async function restockedUnitsByItem(tx: Tx, orderId: string): Promise<Map<string, number>> {
  const rows = await tx.returnItem.groupBy({
    by: ['orderItemId'],
    where: { condition: 'resellable', returnRequest: { orderId, status: { not: 'rejected' } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
}

export const orderCurrency = (tx: Tx, orderId: string) =>
  tx.order.findUnique({ where: { id: orderId }, select: { currency: true } });

// =============================================================================================
// Expense Categories (11.1)
// =============================================================================================

export async function listExpenseCategories(tx: Tx) {
  const categories = await tx.expenseCategory.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { expenses: true } },
    },
  });

  const totals = await tx.expense.groupBy({
    by: ['categoryId'],
    _sum: { amountMinor: true },
  });

  const sumMap = new Map(totals.map((t) => [t.categoryId, t._sum.amountMinor ?? 0n]));

  return categories.map((cat) => ({
    ...cat,
    expenseCount: cat._count.expenses,
    totalSpentMinor: sumMap.get(cat.id) ?? 0n,
  }));
}

export async function findExpenseCategory(tx: Tx, id: string) {
  return tx.expenseCategory.findUnique({ where: { id } });
}

export async function createExpenseCategory(tx: Tx, data: CreateExpenseCategoryInput) {
  return tx.expenseCategory.create({
    data: {
      id: randomUUID(),
      name: data.name,
      type: data.type,
      isCogs: data.isCogs,
      description: data.description,
    },
  });
}

export async function updateExpenseCategory(tx: Tx, data: UpdateExpenseCategoryInput) {
  return tx.expenseCategory.update({
    where: { id: data.id },
    data: {
      name: data.name,
      type: data.type,
      isCogs: data.isCogs,
      description: data.description,
    },
  });
}

export async function deleteExpenseCategory(tx: Tx, id: string) {
  return tx.expenseCategory.delete({ where: { id } });
}

// =============================================================================================
// Marketing Campaigns (11.4)
// =============================================================================================

export async function listMarketingCampaigns(tx: Tx) {
  const campaigns = await tx.marketingCampaign.findMany({
    orderBy: { startsOn: 'desc' },
    include: {
      expenses: {
        select: { amountMinor: true },
      },
    },
  });

  const utmAttributions = await tx.$queryRaw<
    Array<{
      utm_campaign: string;
      orders_count: number;
      revenue_minor: bigint;
    }>
  >`
    SELECT
      utm->>'utm_campaign' AS utm_campaign,
      COUNT(*)::integer AS orders_count,
      SUM(total_minor)::bigint AS revenue_minor
    FROM orders
    WHERE utm IS NOT NULL
      AND utm->>'utm_campaign' IS NOT NULL
      AND status NOT IN ('cancelled', 'payment_expired', 'returned_to_origin')
    GROUP BY utm->>'utm_campaign'
  `;

  const attrMap = new Map(
    utmAttributions.map((a) => [
      a.utm_campaign,
      { count: a.orders_count, revenue: a.revenue_minor },
    ]),
  );

  return campaigns.map((camp) => {
    const totalSpend = camp.expenses.reduce((acc, curr) => acc + curr.amountMinor, 0n);
    const attr = camp.utmCampaign ? attrMap.get(camp.utmCampaign) : undefined;
    const ordersCount = attr?.count ?? 0;
    const revenueMinor = attr?.revenue ?? 0n;

    let roas: string | null = null;
    if (totalSpend > 0n && revenueMinor > 0n) {
      const roasFloat = Number(revenueMinor) / Number(totalSpend);
      roas = `${roasFloat.toFixed(1)}x`;
    }

    return {
      ...camp,
      spendMinor: totalSpend,
      attributedOrdersCount: ordersCount,
      attributedRevenueMinor: revenueMinor,
      roas,
    };
  });
}

export async function findMarketingCampaign(tx: Tx, id: string) {
  return tx.marketingCampaign.findUnique({ where: { id } });
}

export async function createMarketingCampaign(tx: Tx, data: CreateMarketingCampaignInput) {
  return tx.marketingCampaign.create({
    data: {
      id: randomUUID(),
      name: data.name,
      channel: data.channel,
      utmCampaign: data.utmCampaign,
      startsOn: new Date(data.startsOn),
      endsOn: data.endsOn ? new Date(data.endsOn) : null,
      budgetMinor: data.budgetMinor,
    },
  });
}

export async function updateMarketingCampaign(tx: Tx, data: UpdateMarketingCampaignInput) {
  return tx.marketingCampaign.update({
    where: { id: data.id },
    data: {
      name: data.name,
      channel: data.channel,
      utmCampaign: data.utmCampaign,
      startsOn: data.startsOn ? new Date(data.startsOn) : undefined,
      endsOn: data.endsOn ? new Date(data.endsOn) : null,
      budgetMinor: data.budgetMinor,
    },
  });
}

export async function deleteMarketingCampaign(tx: Tx, id: string) {
  return tx.marketingCampaign.delete({ where: { id } });
}

// =============================================================================================
// Recurring Expenses (11.3)
// =============================================================================================

export async function listRecurringExpenses(tx: Tx) {
  return tx.recurringExpense.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true, type: true } },
    },
  });
}

export async function findRecurringExpense(tx: Tx, id: string) {
  return tx.recurringExpense.findUnique({
    where: { id },
    include: { category: true },
  });
}

export async function createRecurringExpense(tx: Tx, data: CreateRecurringExpenseInput) {
  return tx.recurringExpense.create({
    data: {
      id: randomUUID(),
      categoryId: data.categoryId,
      vendor: data.vendor,
      amountMinor: data.amountMinor,
      currency: data.currency,
      cadence: data.cadence,
      dayOfPeriod: data.dayOfPeriod,
      startsOn: new Date(data.startsOn),
      endsOn: data.endsOn ? new Date(data.endsOn) : null,
      isActive: data.isActive,
    },
  });
}

export async function updateRecurringExpense(tx: Tx, data: UpdateRecurringExpenseInput) {
  return tx.recurringExpense.update({
    where: { id: data.id },
    data: {
      categoryId: data.categoryId,
      vendor: data.vendor,
      amountMinor: data.amountMinor,
      currency: data.currency,
      cadence: data.cadence,
      dayOfPeriod: data.dayOfPeriod,
      startsOn: data.startsOn ? new Date(data.startsOn) : undefined,
      endsOn: data.endsOn ? new Date(data.endsOn) : null,
      isActive: data.isActive,
    },
  });
}

export async function deleteRecurringExpense(tx: Tx, id: string) {
  return tx.recurringExpense.delete({ where: { id } });
}

// =============================================================================================
// Expenses (11.2)
// =============================================================================================

export async function listExpenses(tx: Tx, params: ExpenseFilterParams) {
  const where: Record<string, unknown> = {};

  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.campaignId) where.campaignId = params.campaignId;
  if (params.from || params.to) {
    where.expenseDate = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(params.to) } : {}),
    };
  }

  if (params.search) {
    where.OR = [
      { vendor: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { reference: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [totalCount, totalSum, items] = await Promise.all([
    tx.expense.count({ where }),
    tx.expense.aggregate({
      where,
      _sum: { amountMinor: true },
    }),
    tx.expense.findMany({
      where,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      take: params.limit ?? 25,
      include: {
        category: { select: { id: true, name: true, type: true, isCogs: true } },
        campaign: { select: { id: true, name: true } },
        creator: {
          select: { user: { select: { name: true } } },
        },
      },
    }),
  ]);

  return {
    items,
    totalCount,
    totalSumMinor: totalSum._sum.amountMinor ?? 0n,
  };
}

export async function findExpense(tx: Tx, id: string) {
  return tx.expense.findUnique({
    where: { id },
    include: {
      category: true,
      campaign: true,
    },
  });
}

export async function createExpense(
  tx: Tx,
  data: CreateExpenseInput & { createdBy?: string | null },
) {
  return tx.expense.create({
    data: {
      id: randomUUID(),
      expenseDate: new Date(data.expenseDate),
      categoryId: data.categoryId,
      campaignId: data.campaignId ?? null,
      recurringExpenseId: data.recurringExpenseId ?? null,
      vendor: data.vendor,
      description: data.description,
      amountMinor: data.amountMinor,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      reference: data.reference ?? null,
      attachmentUrl: data.attachmentUrl ?? null,
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function updateExpense(tx: Tx, data: UpdateExpenseInput) {
  return tx.expense.update({
    where: { id: data.id },
    data: {
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      categoryId: data.categoryId,
      campaignId: data.campaignId,
      recurringExpenseId: data.recurringExpenseId,
      vendor: data.vendor,
      description: data.description,
      amountMinor: data.amountMinor,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      attachmentUrl: data.attachmentUrl,
    },
  });
}

export async function deleteExpense(tx: Tx, id: string) {
  return tx.expense.delete({ where: { id } });
}

// =============================================================================================
// Profit & Loss Report (11.8)
// =============================================================================================

export async function queryProfitAndLossRaw(
  tx: Tx,
  params: {
    recognitionMode: PAndLRecognitionMode;
    from: string;
    to: string;
    grouping: 'day' | 'week' | 'month';
  },
) {
  const fromDate = new Date(params.from);
  const toDate = new Date(params.to);

  const isDelivered = params.recognitionMode === 'delivered';

  // 1. Order lines aggregation
  const orderStats = await tx.$queryRaw<
    Array<{
      orders_count: number;
      gross_sales: bigint;
      discounts: bigint;
      refunds: bigint;
      net_sales: bigint;
      shipping_charged: bigint;
    }>
  >`
    SELECT
      COUNT(DISTINCT o.id)::integer AS orders_count,
      COALESCE(SUM(o.subtotal_minor), 0)::bigint AS gross_sales,
      COALESCE(SUM(o.discount_minor), 0)::bigint AS discounts,
      COALESCE(SUM(o.refunded_minor), 0)::bigint AS refunds,
      COALESCE(SUM(o.subtotal_minor - o.discount_minor - o.refunded_minor), 0)::bigint AS net_sales,
      COALESCE(SUM(o.shipping_charged_minor), 0)::bigint AS shipping_charged
    FROM orders o
    WHERE (
      (${isDelivered} AND o.delivered_at >= ${fromDate} AND o.delivered_at <= ${toDate})
      OR
      (NOT ${isDelivered} AND o.placed_at >= ${fromDate} AND o.placed_at <= ${toDate})
    )
    AND o.status NOT IN ('cancelled', 'payment_expired', 'returned_to_origin')
  `;

  // 2. COGS from order_items
  const cogsStats = await tx.$queryRaw<Array<{ cogs: bigint }>>`
    SELECT
      COALESCE(SUM(oi.quantity * oi.unit_cost_minor), 0)::bigint AS cogs
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (
      (${isDelivered} AND o.delivered_at >= ${fromDate} AND o.delivered_at <= ${toDate})
      OR
      (NOT ${isDelivered} AND o.placed_at >= ${fromDate} AND o.placed_at <= ${toDate})
    )
    AND o.status NOT IN ('cancelled', 'payment_expired', 'returned_to_origin')
  `;

  // 3. Variable Order Cost Lines (courier, gateway, cod, packaging, rto, return)
  const costLinesStats = await tx.$queryRaw<
    Array<{
      type: string;
      total: bigint;
    }>
  >`
    SELECT
      cl.type::text AS type,
      COALESCE(SUM(cl.amount_minor), 0)::bigint AS total
    FROM order_cost_lines cl
    JOIN orders o ON o.id = cl.order_id
    WHERE (
      (${isDelivered} AND o.delivered_at >= ${fromDate} AND o.delivered_at <= ${toDate})
      OR
      (NOT ${isDelivered} AND o.placed_at >= ${fromDate} AND o.placed_at <= ${toDate})
    )
    GROUP BY cl.type
  `;

  // 4. Operating Expenses from expenses table
  const opexStats = await tx.$queryRaw<
    Array<{
      category_type: string;
      total: bigint;
    }>
  >`
    SELECT
      ec.type::text AS category_type,
      COALESCE(SUM(e.amount_minor), 0)::bigint AS total
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.expense_date >= ${fromDate}
      AND e.expense_date <= ${toDate}
      AND ec.is_cogs = false
    GROUP BY ec.type
  `;

  // 5. Category COGS expenses (raw materials, packaging stock) not tied to orders
  const directCogsExpenses = await tx.$queryRaw<Array<{ total: bigint }>>`
    SELECT
      COALESCE(SUM(e.amount_minor), 0)::bigint AS total
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.expense_date >= ${fromDate}
      AND e.expense_date <= ${toDate}
      AND ec.is_cogs = true
  `;

  return {
    orders: orderStats[0] ?? {
      orders_count: 0,
      gross_sales: 0n,
      discounts: 0n,
      refunds: 0n,
      net_sales: 0n,
      shipping_charged: 0n,
    },
    orderCogs: cogsStats[0]?.cogs ?? 0n,
    directCogs: directCogsExpenses[0]?.total ?? 0n,
    costLines: costLinesStats,
    opex: opexStats,
  };
}

// =============================================================================================
// Product Profitability (11.9)
// =============================================================================================

export async function queryProductProfitability(tx: Tx, limit = 50) {
  return tx.$queryRaw<
    Array<{
      product_id: string;
      title: string;
      product_type: string;
      category_name: string;
      thumbnail_url: string | null;
      units_sold: number;
      units_returned: number;
      gross_revenue_minor: bigint;
      cogs_minor: bigint;
    }>
  >`
    SELECT
      p.id AS product_id,
      p.title,
      p.product_type,
      c.name AS category_name,
      (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.position ASC LIMIT 1) AS thumbnail_url,
      COALESCE(SUM(oi.quantity), 0)::integer AS units_sold,
      COALESCE(SUM(oi.quantity_returned), 0)::integer AS units_returned,
      COALESCE(SUM(oi.total_minor), 0)::bigint AS gross_revenue_minor,
      COALESCE(SUM(oi.quantity * oi.unit_cost_minor), 0)::bigint AS cogs_minor
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'payment_expired', 'returned_to_origin')
    GROUP BY p.id, p.title, p.product_type, c.name
    ORDER BY gross_revenue_minor DESC
    LIMIT ${limit}
  `;
}

// =============================================================================================
// Finance Executive Overview Metrics
// =============================================================================================

export async function queryFinanceOverview(tx: Tx) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const now = new Date();

  // Current month orders
  const orders = await tx.$queryRaw<
    Array<{
      net_sales: bigint;
      cogs: bigint;
    }>
  >`
    SELECT
      COALESCE(SUM(o.subtotal_minor - o.discount_minor - o.refunded_minor), 0)::bigint AS net_sales,
      COALESCE(SUM((SELECT SUM(oi.quantity * oi.unit_cost_minor) FROM order_items oi WHERE oi.order_id = o.id)), 0)::bigint AS cogs
    FROM orders o
    WHERE o.placed_at >= ${startOfMonth}
      AND o.placed_at <= ${now}
      AND o.status NOT IN ('cancelled', 'payment_expired', 'returned_to_origin')
  `;

  // Current month expenses
  const expenses = await tx.$queryRaw<Array<{ total: bigint }>>`
    SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total
    FROM expenses
    WHERE expense_date >= ${startOfMonth}
      AND expense_date <= ${now}
  `;

  // Active campaigns
  const activeCampaigns = await tx.marketingCampaign.count({
    where: {
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
    },
  });

  // Monthly recurring commitment
  const recurring = await tx.recurringExpense.aggregate({
    where: { isActive: true },
    _sum: { amountMinor: true },
  });

  const netSales = orders[0]?.net_sales ?? 0n;
  const cogs = orders[0]?.cogs ?? 0n;
  const grossProfit = netSales > cogs ? netSales - cogs : 0n;
  const totalExp = expenses[0]?.total ?? 0n;
  const netProfit = grossProfit - totalExp;

  return {
    netSalesMinor: netSales,
    grossProfitMinor: grossProfit,
    totalExpensesMinor: totalExp,
    netProfitMinor: netProfit,
    activeCampaignsCount: activeCampaigns,
    monthlyRecurringCommitmentMinor: recurring._sum.amountMinor ?? 0n,
  };
}
