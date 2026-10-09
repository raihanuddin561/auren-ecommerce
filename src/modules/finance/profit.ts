import { divideRound } from '@/lib/money';

/**
 * Order profit, exactly as ARCHITECTURE section 7.2 defines it. Pure: money in minor units as
 * bigint, no database, no clock. Everything is derived from records (the order line snapshots, the
 * cost lines, the refunds), never typed in by hand.
 *
 *   Gross sales         = sum(unit price x quantity)
 *   Net sales           = gross sales - discounts - refunds
 *   COGS                = sum(unit cost snapshot x quantity) - restocked returns at cost
 *   Gross profit        = net sales - COGS
 *   Contribution margin = gross profit + shipping charged - shipping cost - gateway fees
 *                         - COD fees - packaging - return and RTO costs (- other costs)
 *
 * Revenue is recognised when the order is delivered (the default of section 7.2), because cash on
 * delivery money is not real until then. Before that the same figures are a projection.
 */

export interface ProfitLineInput {
  quantity: number;
  /** Price per unit at the time of sale. A replacement line from an exchange is priced 0. */
  unitPriceMinor: bigint;
  /** Cost of goods per unit at the time of sale (the snapshot). */
  unitCostMinor: bigint;
  /** Line level discount, if any. */
  discountMinor: bigint;
  /** Returned units that went back on the shelf (resellable): their cost comes back. */
  restockedUnits: number;
}

export interface ProfitCostLineInput {
  type:
    'shipping' | 'gateway_fee' | 'cod_fee' | 'packaging' | 'return_shipping' | 'rto_loss' | 'other';
  amountMinor: bigint;
}

export interface OrderProfitInput {
  lines: readonly ProfitLineInput[];
  /** Order level discount (discount codes). */
  orderDiscountMinor: bigint;
  /** What the customer paid for delivery. */
  shippingChargedMinor: bigint;
  /** Refunds that went out (succeeded only). */
  refundedMinor: bigint;
  costLines: readonly ProfitCostLineInput[];
  /** True once the order is delivered (or completed): revenue is recognised. */
  recognised: boolean;
}

export interface OrderProfit {
  grossSalesMinor: bigint;
  discountsMinor: bigint;
  refundsMinor: bigint;
  netSalesMinor: bigint;
  cogsMinor: bigint;
  grossProfitMinor: bigint;
  shippingChargedMinor: bigint;
  shippingCostMinor: bigint;
  gatewayFeesMinor: bigint;
  codFeesMinor: bigint;
  packagingMinor: bigint;
  /** Return shipping plus the loss on parcels sent back to us. */
  returnCostsMinor: bigint;
  otherCostsMinor: bigint;
  contributionMarginMinor: bigint;
  /** Contribution margin as a share of net sales in basis points (1250 = 12.5 %), null when net sales are zero. */
  marginBps: bigint | null;
  recognised: boolean;
}

const sumCosts = (lines: readonly ProfitCostLineInput[], types: ProfitCostLineInput['type'][]) =>
  lines
    .filter((line) => types.includes(line.type))
    .reduce((sum, line) => sum + line.amountMinor, 0n);

export function computeOrderProfit(input: OrderProfitInput): OrderProfit {
  let grossSales = 0n;
  let lineDiscounts = 0n;
  let cogs = 0n;
  for (const line of input.lines) {
    grossSales += line.unitPriceMinor * BigInt(line.quantity);
    lineDiscounts += line.discountMinor;
    cogs += line.unitCostMinor * BigInt(line.quantity - line.restockedUnits);
  }
  const discounts = input.orderDiscountMinor + lineDiscounts;
  const netSales = grossSales - discounts - input.refundedMinor;
  const grossProfit = netSales - cogs;

  const shippingCost = sumCosts(input.costLines, ['shipping']);
  const gatewayFees = sumCosts(input.costLines, ['gateway_fee']);
  const codFees = sumCosts(input.costLines, ['cod_fee']);
  const packaging = sumCosts(input.costLines, ['packaging']);
  const returnCosts = sumCosts(input.costLines, ['return_shipping', 'rto_loss']);
  const other = sumCosts(input.costLines, ['other']);

  const contribution =
    grossProfit +
    input.shippingChargedMinor -
    shippingCost -
    gatewayFees -
    codFees -
    packaging -
    returnCosts -
    other;

  return {
    grossSalesMinor: grossSales,
    discountsMinor: discounts,
    refundsMinor: input.refundedMinor,
    netSalesMinor: netSales,
    cogsMinor: cogs,
    grossProfitMinor: grossProfit,
    shippingChargedMinor: input.shippingChargedMinor,
    shippingCostMinor: shippingCost,
    gatewayFeesMinor: gatewayFees,
    codFeesMinor: codFees,
    packagingMinor: packaging,
    returnCostsMinor: returnCosts,
    otherCostsMinor: other,
    contributionMarginMinor: contribution,
    marginBps: netSales > 0n ? divideRound(contribution * 10_000n, netSales, 'half-even') : null,
    recognised: input.recognised,
  };
}

/** "12.5 %" from basis points (rounded to one decimal); "n/a" when there are no net sales. */
export function formatMargin(bps: bigint | null): string {
  if (bps === null) return 'n/a';
  const abs = bps < 0n ? -bps : bps;
  const tenths = divideRound(abs, 10n, 'half-even');
  return `${bps < 0n && tenths > 0n ? '-' : ''}${tenths / 10n}.${tenths % 10n} %`;
}
