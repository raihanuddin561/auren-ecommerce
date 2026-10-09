import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { format, money, serialize } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as inventory from '@/modules/inventory/service';
import { computeOrderProfit, type OrderProfit } from './profit';
import * as repo from './repository';
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateMarketingCampaignInput,
  CreateRecurringExpenseInput,
  ExpenseFilterInput,
  PAndLFilterInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateMarketingCampaignInput,
  UpdateRecurringExpenseInput,
} from './schemas';
import type {
  CostType,
  ExpenseCategoryItem,
  ExpenseListItem,
  ExpenseListResult,
  FinanceOverviewMetrics,
  MarketingCampaignItem,
  OrderProfitView,
  PAndLPeriodFigures,
  ProductProfitabilityRow,
  ProfitAndLossReport,
  RecurringExpenseItem,
} from './types';

export type { CostType, OrderProfit, OrderProfitView };

// ---------------------------------------------------------------------------------------------
// Order cost lines (11.5)
// ---------------------------------------------------------------------------------------------

export interface RecordCostInput {
  orderId: string;
  type: CostType;
  amountMinor: bigint;
  currency: string;
  /** Where the cost came from, for example `shipment`. A cost with a source is recorded once. */
  sourceType?: string;
  sourceId?: string;
  note?: string | null;
  /** staff_members.id or null for an automatic line. */
  actorId?: string | null;
}

/**
 * Records one cost against an order, in the caller's transaction. Automatic costs (courier,
 * packaging, COD fee, gateway fee, return shipping, RTO loss) pass the record they come from, so the
 * same cost is never counted twice when a job or a handler runs again (INV-F2, INV-E2).
 */
export async function recordCostLine(tx: Tx, input: RecordCostInput): Promise<boolean> {
  if (input.amountMinor === 0n) return false;
  if (input.sourceId && !input.sourceType) {
    throw new DomainError('INTERNAL', 'A cost with a source id needs a source type.');
  }
  return repo.insertCostLine(tx, {
    orderId: input.orderId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    note: input.note ?? null,
    actorId: input.actorId ?? null,
  });
}

/**
 * Brings the booked amount of one source up (or down) to `targetMinor` with a delta line, so a
 * corrected courier charge changes the order cost without rewriting history.
 */
export async function setSourceCost(
  tx: Tx,
  input: {
    orderId: string;
    type: CostType;
    currency: string;
    sourceType: string;
    sourceId: string;
    targetMinor: bigint;
    actorId?: string | null;
    note?: string;
  },
): Promise<bigint> {
  const booked = await repo.sumCostBySource(
    tx,
    input.orderId,
    input.type,
    input.sourceType,
    input.sourceId,
  );
  const delta = input.targetMinor - booked;
  if (delta === 0n) return 0n;
  const first = booked === 0n;
  await repo.insertCostLine(tx, {
    orderId: input.orderId,
    type: input.type,
    amountMinor: delta,
    currency: input.currency,
    sourceType: input.sourceType,
    sourceId: first ? input.sourceId : `${input.sourceId}:adj:${crypto.randomUUID()}`,
    note: input.note ?? (first ? null : 'Correction'),
    actorId: input.actorId ?? null,
  });
  return delta;
}

/** Gateway fee captured when an online payment succeeds (5.4). Cash on delivery has none. */
export async function recordGatewayFee(
  tx: Tx,
  input: { orderId: string; paymentId: string; feeMinor: bigint; currency: string },
): Promise<boolean> {
  return recordCostLine(tx, {
    orderId: input.orderId,
    type: 'gateway_fee',
    amountMinor: input.feeMinor,
    currency: input.currency,
    sourceType: 'payment',
    sourceId: input.paymentId,
  });
}

export interface AddManualCostInput {
  orderId: string;
  amountMinor: bigint;
  note: string;
  actorUserId: string;
  actorStaffId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Staff adds a cost nobody records automatically (a gift wrap, a tip to the rider). Audited. */
export async function addManualCostLine(input: AddManualCostInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await repo.orderCurrency(tx, input.orderId);
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
    await recordCostLine(tx, {
      orderId: input.orderId,
      type: 'other',
      amountMinor: input.amountMinor,
      currency: order.currency,
      note: input.note,
      actorId: input.actorStaffId,
    });
    await audit(tx, {
      actorId: input.actorUserId,
      action: 'order.cost_add',
      entity: 'order',
      entityId: input.orderId,
      after: { amountMinor: input.amountMinor.toString(), note: input.note },
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Order profit breakdown (11.6)
// ---------------------------------------------------------------------------------------------

/** Orders where no sale happened (cancelled, sent back to origin): only costs and unrecovered goods count. */
const NO_SALE = new Set(['cancelled', 'returned_to_origin', 'payment_expired']);

/** Statuses in which revenue counts (delivered date, ARCHITECTURE section 7.2). */
const RECOGNISED = new Set([
  'delivered',
  'completed',
  'return_requested',
  'returned',
  'refunded',
  'exchanged',
]);

/**
 * The profit of one order, derived from its line snapshots, its cost lines and its refunds.
 */
export async function getOrderProfit(
  orderId: string,
  tx: Tx = db,
): Promise<OrderProfitView | null> {
  const order = await repo.orderForProfit(tx, orderId);
  if (!order) return null;
  const [costLines, restocked] = await Promise.all([
    repo.listCostLines(tx, orderId),
    repo.restockedUnitsByItem(tx, orderId),
  ]);
  const recognised = RECOGNISED.has(order.status);
  const noSale = NO_SALE.has(order.status);
  const stillOut = noSale ? await inventory.netSoldStock(tx, 'order', orderId) : null;
  const profit = computeOrderProfit({
    lines: order.items.map((item) => ({
      quantity: item.quantity,
      unitPriceMinor: noSale ? 0n : item.unitPriceMinor,
      unitCostMinor: item.unitCostMinor,
      discountMinor: noSale ? 0n : item.discountMinor,
      restockedUnits: noSale
        ? Math.max(0, item.quantity - (stillOut?.get(item.variantId) ?? 0))
        : Math.min(item.quantity, restocked.get(item.id) ?? 0),
    })),
    orderDiscountMinor: noSale ? 0n : order.discountMinor,
    shippingChargedMinor: noSale ? 0n : order.shippingChargedMinor,
    refundedMinor: noSale ? 0n : order.refundedMinor,
    costLines: costLines.map((line) => ({ type: line.type, amountMinor: line.amountMinor })),
    recognised,
  });
  const at = (minor: bigint) => serialize(money(minor, order.currency));
  return {
    recognised,
    currency: order.currency,
    figures: {
      grossSales: at(profit.grossSalesMinor),
      discounts: at(profit.discountsMinor),
      refunds: at(profit.refundsMinor),
      netSales: at(profit.netSalesMinor),
      cogs: at(profit.cogsMinor),
      grossProfit: at(profit.grossProfitMinor),
      shippingCharged: at(profit.shippingChargedMinor),
      shippingCost: at(profit.shippingCostMinor),
      gatewayFees: at(profit.gatewayFeesMinor),
      codFees: at(profit.codFeesMinor),
      packaging: at(profit.packagingMinor),
      returnCosts: at(profit.returnCostsMinor),
      otherCosts: at(profit.otherCostsMinor),
      contributionMargin: at(profit.contributionMarginMinor),
    },
    marginBps: profit.marginBps === null ? null : profit.marginBps.toString(),
    costLines: costLines.map((line) => ({
      type: line.type,
      amount: at(line.amountMinor),
      note: line.note,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}

// =============================================================================================
// Expense Categories Service (11.1)
// =============================================================================================

export async function getExpenseCategories(tx: Tx = db): Promise<ExpenseCategoryItem[]> {
  const rows = await repo.listExpenseCategories(tx);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    isCogs: r.isCogs,
    description: r.description,
    expenseCount: r.expenseCount,
    totalSpentFormatted: format(money(r.totalSpentMinor, 'BDT')),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createExpenseCategory(
  input: CreateExpenseCategoryInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  return db.$transaction(async (tx) => {
    const created = await repo.createExpenseCategory(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense_category.create',
      entity: 'expense_category',
      entityId: created.id,
      after: { name: created.name, type: created.type, isCogs: created.isCogs },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return created.id;
  });
}

export async function updateExpenseCategory(
  input: UpdateExpenseCategoryInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findExpenseCategory(tx, input.id);
    if (!before) throw new DomainError('NOT_FOUND', 'Expense category not found');
    const updated = await repo.updateExpenseCategory(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense_category.update',
      entity: 'expense_category',
      entityId: updated.id,
      before: { name: before.name, type: before.type, isCogs: before.isCogs },
      after: { name: updated.name, type: updated.type, isCogs: updated.isCogs },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

export async function deleteExpenseCategory(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findExpenseCategory(tx, id);
    if (!before) throw new DomainError('NOT_FOUND', 'Expense category not found');
    await repo.deleteExpenseCategory(tx, id);
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense_category.delete',
      entity: 'expense_category',
      entityId: id,
      before: { name: before.name, type: before.type },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

// =============================================================================================
// Marketing Campaigns Service (11.4)
// =============================================================================================

export async function getMarketingCampaigns(tx: Tx = db): Promise<MarketingCampaignItem[]> {
  const rows = await repo.listMarketingCampaigns(tx);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    channel: r.channel,
    utmCampaign: r.utmCampaign,
    startsOn: r.startsOn.toISOString().split('T')[0] ?? '',
    endsOn: r.endsOn ? (r.endsOn.toISOString().split('T')[0] ?? null) : null,
    budgetFormatted: format(money(r.budgetMinor, 'BDT')),
    spendFormatted: format(money(r.spendMinor, 'BDT')),
    attributedOrdersCount: r.attributedOrdersCount,
    attributedRevenueFormatted: format(money(r.attributedRevenueMinor, 'BDT')),
    roas: r.roas,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createMarketingCampaign(
  input: CreateMarketingCampaignInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  return db.$transaction(async (tx) => {
    const created = await repo.createMarketingCampaign(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'marketing_campaign.create',
      entity: 'marketing_campaign',
      entityId: created.id,
      after: {
        name: created.name,
        channel: created.channel,
        utmCampaign: created.utmCampaign,
        budgetMinor: created.budgetMinor.toString(),
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return created.id;
  });
}

export async function updateMarketingCampaign(
  input: UpdateMarketingCampaignInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findMarketingCampaign(tx, input.id);
    if (!before) throw new DomainError('NOT_FOUND', 'Campaign not found');
    const updated = await repo.updateMarketingCampaign(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'marketing_campaign.update',
      entity: 'marketing_campaign',
      entityId: updated.id,
      before: {
        name: before.name,
        channel: before.channel,
        budgetMinor: before.budgetMinor.toString(),
      },
      after: {
        name: updated.name,
        channel: updated.channel,
        budgetMinor: updated.budgetMinor.toString(),
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

export async function deleteMarketingCampaign(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findMarketingCampaign(tx, id);
    if (!before) throw new DomainError('NOT_FOUND', 'Campaign not found');
    await repo.deleteMarketingCampaign(tx, id);
    await audit(tx, {
      actorId: actor.userId,
      action: 'marketing_campaign.delete',
      entity: 'marketing_campaign',
      entityId: id,
      before: { name: before.name, channel: before.channel },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

// =============================================================================================
// Recurring Expenses Service (11.3)
// =============================================================================================

export async function getRecurringExpenses(tx: Tx = db): Promise<RecurringExpenseItem[]> {
  const rows = await repo.listRecurringExpenses(tx);
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    vendor: r.vendor,
    amountFormatted: format(money(r.amountMinor, r.currency)),
    amountMinor: r.amountMinor.toString(),
    currency: r.currency,
    cadence: r.cadence,
    dayOfPeriod: r.dayOfPeriod,
    startsOn: r.startsOn.toISOString().split('T')[0] ?? '',
    endsOn: r.endsOn ? (r.endsOn.toISOString().split('T')[0] ?? null) : null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createRecurringExpense(
  input: CreateRecurringExpenseInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  return db.$transaction(async (tx) => {
    const created = await repo.createRecurringExpense(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'recurring_expense.create',
      entity: 'recurring_expense',
      entityId: created.id,
      after: {
        vendor: created.vendor,
        amountMinor: created.amountMinor.toString(),
        cadence: created.cadence,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return created.id;
  });
}

export async function updateRecurringExpense(
  input: UpdateRecurringExpenseInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findRecurringExpense(tx, input.id);
    if (!before) throw new DomainError('NOT_FOUND', 'Recurring expense template not found');
    const updated = await repo.updateRecurringExpense(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'recurring_expense.update',
      entity: 'recurring_expense',
      entityId: updated.id,
      before: {
        vendor: before.vendor,
        amountMinor: before.amountMinor.toString(),
        isActive: before.isActive,
      },
      after: {
        vendor: updated.vendor,
        amountMinor: updated.amountMinor.toString(),
        isActive: updated.isActive,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

export async function deleteRecurringExpense(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findRecurringExpense(tx, id);
    if (!before) throw new DomainError('NOT_FOUND', 'Recurring expense template not found');
    await repo.deleteRecurringExpense(tx, id);
    await audit(tx, {
      actorId: actor.userId,
      action: 'recurring_expense.delete',
      entity: 'recurring_expense',
      entityId: id,
      before: { vendor: before.vendor, amountMinor: before.amountMinor.toString() },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

// =============================================================================================
// Expenses Service (11.2)
// =============================================================================================

export async function getExpenses(
  params: ExpenseFilterInput,
  tx: Tx = db,
): Promise<ExpenseListResult> {
  const result = await repo.listExpenses(tx, params);
  const items: ExpenseListItem[] = result.items.map((e) => ({
    id: e.id,
    expenseDate: e.expenseDate.toISOString().split('T')[0] ?? '',
    categoryId: e.categoryId,
    categoryName: e.category.name,
    categoryType: e.category.type,
    isCogs: e.category.isCogs,
    campaignId: e.campaignId,
    campaignName: e.campaign?.name ?? null,
    recurringExpenseId: e.recurringExpenseId,
    vendor: e.vendor,
    description: e.description,
    amountFormatted: format(money(e.amountMinor, e.currency)),
    amountMinor: e.amountMinor.toString(),
    currency: e.currency,
    paymentMethod: e.paymentMethod,
    reference: e.reference,
    attachmentUrl: e.attachmentUrl,
    createdByName: e.creator?.user.name ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return {
    items,
    totalCount: result.totalCount,
    totalSumFormatted: format(money(result.totalSumMinor, 'BDT')),
    nextCursor: items.length >= (params.limit ?? 25) ? items[items.length - 1]?.id : undefined,
  };
}

export async function createExpense(
  input: CreateExpenseInput,
  actor: { userId: string; staffId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  return db.$transaction(async (tx) => {
    const created = await repo.createExpense(tx, { ...input, createdBy: actor.staffId });
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense.create',
      entity: 'expense',
      entityId: created.id,
      after: {
        vendor: created.vendor,
        amountMinor: created.amountMinor.toString(),
        category: created.categoryId,
        description: created.description,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return created.id;
  });
}

export async function updateExpense(
  input: UpdateExpenseInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findExpense(tx, input.id);
    if (!before) throw new DomainError('NOT_FOUND', 'Expense not found');
    const updated = await repo.updateExpense(tx, input);
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense.update',
      entity: 'expense',
      entityId: updated.id,
      before: {
        vendor: before.vendor,
        amountMinor: before.amountMinor.toString(),
        description: before.description,
      },
      after: {
        vendor: updated.vendor,
        amountMinor: updated.amountMinor.toString(),
        description: updated.description,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

export async function deleteExpense(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await repo.findExpense(tx, id);
    if (!before) throw new DomainError('NOT_FOUND', 'Expense not found');
    await repo.deleteExpense(tx, id);
    await audit(tx, {
      actorId: actor.userId,
      action: 'expense.delete',
      entity: 'expense',
      entityId: id,
      before: { vendor: before.vendor, amountMinor: before.amountMinor.toString() },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  });
}

export async function exportExpensesCsv(
  params: Partial<ExpenseFilterInput> = {},
  tx: Tx = db,
): Promise<string> {
  const result = await repo.listExpenses(tx, { ...params, limit: 10000 });
  const headers = [
    'Date',
    'Category',
    'Type',
    'COGS',
    'Vendor',
    'Description',
    'Amount (BDT)',
    'Method',
    'Reference',
    'Campaign',
  ];
  const rows = result.items.map((e) => [
    e.expenseDate.toISOString().split('T')[0] ?? '',
    `"${e.category.name.replace(/"/g, '""')}"`,
    e.category.type,
    e.category.isCogs ? 'Yes' : 'No',
    `"${e.vendor.replace(/"/g, '""')}"`,
    `"${e.description.replace(/"/g, '""')}"`,
    (Number(e.amountMinor) / 100).toFixed(2),
    e.paymentMethod,
    `"${(e.reference ?? '').replace(/"/g, '""')}"`,
    `"${(e.campaign?.name ?? '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// =============================================================================================
// Profit & Loss Report Service (11.8)
// =============================================================================================

export async function getProfitAndLossReport(
  params: PAndLFilterInput,
  tx: Tx = db,
): Promise<ProfitAndLossReport> {
  const now = new Date();
  const defaultFrom =
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] ?? '';
  const defaultTo = now.toISOString().split('T')[0] ?? '';

  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  const raw = await repo.queryProfitAndLossRaw(tx, {
    recognitionMode: params.recognitionMode,
    from,
    to,
    grouping: params.grouping,
  });

  const grossSales = raw.orders.gross_sales;
  const discounts = raw.orders.discounts;
  const refunds = raw.orders.refunds;
  const netSales = raw.orders.net_sales;
  const cogs = raw.orderCogs + raw.directCogs;
  const grossProfit = netSales > cogs ? netSales - cogs : 0n;

  const costMap = new Map(raw.costLines.map((c) => [c.type, c.total]));
  const shippingCost = costMap.get('shipping') ?? 0n;
  const gatewayFees = costMap.get('gateway_fee') ?? 0n;
  const codFees = costMap.get('cod_fee') ?? 0n;
  const packaging = costMap.get('packaging') ?? 0n;
  const returnShipping = costMap.get('return_shipping') ?? 0n;
  const rtoLoss = costMap.get('rto_loss') ?? 0n;
  const returnsAndRto = returnShipping + rtoLoss;

  const variableFulfillment = shippingCost + gatewayFees + codFees + packaging + returnsAndRto;
  const contributionMargin =
    grossProfit > variableFulfillment
      ? grossProfit - variableFulfillment
      : -(variableFulfillment - grossProfit);

  const opexMap = new Map(raw.opex.map((o) => [o.category_type, o.total]));
  const marketingSpend = opexMap.get('marketing') ?? 0n;
  const payroll = opexMap.get('payroll') ?? 0n;
  const rent = opexMap.get('rent') ?? 0n;
  const utilities = opexMap.get('utilities') ?? 0n;
  const software = opexMap.get('software') ?? 0n;
  const professionalFees = opexMap.get('professional_fees') ?? 0n;
  const bankCharges = opexMap.get('bank_charges') ?? 0n;
  const photography = opexMap.get('photography') ?? 0n;
  const misc = opexMap.get('misc') ?? 0n;
  const otherOpex = professionalFees + bankCharges + photography + misc;
  const totalOpex = marketingSpend + payroll + rent + utilities + software + otherOpex;

  const netProfit = contributionMargin - totalOpex;

  const formatBdt = (val: bigint) => format(money(val, 'BDT'));
  const pct = (num: bigint, denom: bigint) => {
    if (denom <= 0n) return '0.0%';
    const p = (Number(num) / Number(denom)) * 100;
    return `${p.toFixed(1)}%`;
  };

  const figures: PAndLPeriodFigures = {
    grossSalesFormatted: formatBdt(grossSales),
    discountsFormatted: formatBdt(discounts),
    refundsFormatted: formatBdt(refunds),
    netSalesFormatted: formatBdt(netSales),
    cogsFormatted: formatBdt(cogs),
    grossProfitFormatted: formatBdt(grossProfit),
    grossMarginPercent: pct(grossProfit, netSales),
    shippingChargedFormatted: formatBdt(raw.orders.shipping_charged),
    shippingCostFormatted: formatBdt(shippingCost),
    gatewayFeesFormatted: formatBdt(gatewayFees),
    codFeesFormatted: formatBdt(codFees),
    packagingFormatted: formatBdt(packaging),
    returnsAndRtoCostFormatted: formatBdt(returnsAndRto),
    contributionMarginFormatted: formatBdt(contributionMargin),
    contributionMarginPercent: pct(contributionMargin, netSales),
    marketingSpendFormatted: formatBdt(marketingSpend),
    payrollFormatted: formatBdt(payroll),
    rentFormatted: formatBdt(rent),
    utilitiesFormatted: formatBdt(utilities),
    softwareFormatted: formatBdt(software),
    otherOpexFormatted: formatBdt(otherOpex),
    totalOpexFormatted: formatBdt(totalOpex),
    netProfitFormatted: formatBdt(netProfit),
    netMarginPercent: pct(netProfit, netSales),
  };

  return {
    recognitionMode: params.recognitionMode,
    dateFrom: from,
    dateTo: to,
    summary: figures,
    breakdown: [
      {
        periodKey: `${from}_${to}`,
        label: `${from} to ${to}`,
        ordersCount: raw.orders.orders_count,
        figures,
      },
    ],
  };
}

export async function exportProfitAndLossCsv(
  params: PAndLFilterInput,
  tx: Tx = db,
): Promise<string> {
  const report = await getProfitAndLossReport(params, tx);
  const rows = [
    ['Metric', 'Amount (BDT)', 'Percentage of Net Sales'],
    ['Gross Sales', report.summary.grossSalesFormatted, ''],
    ['Discounts', `-${report.summary.discountsFormatted}`, ''],
    ['Refunds', `-${report.summary.refundsFormatted}`, ''],
    ['Net Sales', report.summary.netSalesFormatted, '100.0%'],
    ['Cost of Goods Sold (COGS)', `-${report.summary.cogsFormatted}`, ''],
    ['Gross Profit', report.summary.grossProfitFormatted, report.summary.grossMarginPercent],
    ['Shipping & Courier Delivery', `-${report.summary.shippingCostFormatted}`, ''],
    ['Payment Gateway Fees', `-${report.summary.gatewayFeesFormatted}`, ''],
    ['Cash on Delivery Remittance Fees', `-${report.summary.codFeesFormatted}`, ''],
    ['Packaging & Presentation Boxes', `-${report.summary.packagingFormatted}`, ''],
    ['Returns & Return-to-Origin Losses', `-${report.summary.returnsAndRtoCostFormatted}`, ''],
    [
      'Contribution Margin',
      report.summary.contributionMarginFormatted,
      report.summary.contributionMarginPercent,
    ],
    ['Digital Advertising & Marketing', `-${report.summary.marketingSpendFormatted}`, ''],
    ['Master Tailors & Staff Payroll', `-${report.summary.payrollFormatted}`, ''],
    ['Atelier Studio & Showroom Rent', `-${report.summary.rentFormatted}`, ''],
    ['Studio Utilities & Power', `-${report.summary.utilitiesFormatted}`, ''],
    ['Cloud Infrastructure & Software', `-${report.summary.softwareFormatted}`, ''],
    ['Other Operating Expenses', `-${report.summary.otherOpexFormatted}`, ''],
    ['Total Operating Expenses', `-${report.summary.totalOpexFormatted}`, ''],
    [
      'Net Operating Profit / (Loss)',
      report.summary.netProfitFormatted,
      report.summary.netMarginPercent,
    ],
  ];

  return rows.map((r) => r.join(',')).join('\n');
}

// =============================================================================================
// Product Profitability Service (11.9)
// =============================================================================================

export async function getProductProfitability(
  limit = 50,
  tx: Tx = db,
): Promise<ProductProfitabilityRow[]> {
  const rows = await repo.queryProductProfitability(tx, limit);
  return rows.map((r) => {
    const grossRevenue = r.gross_revenue_minor;
    const cogs = r.cogs_minor;
    const grossProfit = grossRevenue > cogs ? grossRevenue - cogs : 0n;
    const marginPct =
      grossRevenue > 0n ? ((Number(grossProfit) / Number(grossRevenue)) * 100).toFixed(1) : '0.0';
    const returnRatePct =
      r.units_sold > 0 ? ((r.units_returned / r.units_sold) * 100).toFixed(1) : '0.0';

    return {
      productId: r.product_id,
      productTitle: r.title,
      productType: r.product_type,
      categoryName: r.category_name,
      thumbnailUrl: r.thumbnail_url,
      unitsSold: r.units_sold,
      unitsReturned: r.units_returned,
      returnRatePercent: `${returnRatePct}%`,
      grossRevenueFormatted: format(money(grossRevenue, 'BDT')),
      cogsFormatted: format(money(cogs, 'BDT')),
      grossProfitFormatted: format(money(grossProfit, 'BDT')),
      grossMarginPercent: `${marginPct}%`,
    };
  });
}

// =============================================================================================
// Finance Overview Service
// =============================================================================================

export async function getFinanceOverview(tx: Tx = db): Promise<FinanceOverviewMetrics> {
  const m = await repo.queryFinanceOverview(tx);
  const marginPct =
    m.netSalesMinor > 0n
      ? ((Number(m.grossProfitMinor) / Number(m.netSalesMinor)) * 100).toFixed(1)
      : '0.0';
  const netMarginPct =
    m.netSalesMinor > 0n
      ? ((Number(m.netProfitMinor) / Number(m.netSalesMinor)) * 100).toFixed(1)
      : '0.0';

  return {
    currentMonthNetSales: format(money(m.netSalesMinor, 'BDT')),
    currentMonthGrossProfit: format(money(m.grossProfitMinor, 'BDT')),
    currentMonthGrossMarginPercent: `${marginPct}%`,
    currentMonthTotalExpenses: format(money(m.totalExpensesMinor, 'BDT')),
    currentMonthNetProfit: format(money(m.netProfitMinor, 'BDT')),
    currentMonthNetMarginPercent: `${netMarginPct}%`,
    activeCampaignsCount: m.activeCampaignsCount,
    monthlyRecurringSpend: format(money(m.monthlyRecurringCommitmentMinor, 'BDT')),
  };
}
