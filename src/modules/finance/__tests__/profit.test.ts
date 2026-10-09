import { describe, expect, it } from 'vitest';
import { computeOrderProfit, formatMargin, type OrderProfitInput } from '../profit';

/** Money below is in minor units: 250000 is BDT 2,500.00. */
const line = (
  quantity: number,
  price: bigint,
  cost: bigint,
  extra: { restocked?: number; discount?: bigint } = {},
) => ({
  quantity,
  unitPriceMinor: price,
  unitCostMinor: cost,
  discountMinor: extra.discount ?? 0n,
  restockedUnits: extra.restocked ?? 0,
});

const base: OrderProfitInput = {
  lines: [line(2, 250000n, 100000n)],
  orderDiscountMinor: 0n,
  shippingChargedMinor: 13000n,
  refundedMinor: 0n,
  costLines: [],
  recognised: true,
};

describe('order profit (ARCHITECTURE 7.2, INV-F1)', () => {
  it('worked example: two shirts, delivery, courier cost, COD fee and packaging', () => {
    const profit = computeOrderProfit({
      ...base,
      costLines: [
        { type: 'shipping', amountMinor: 9000n },
        { type: 'cod_fee', amountMinor: 5200n },
        { type: 'packaging', amountMinor: 3500n },
      ],
    });
    // Gross sales 2 x 2,500 = 5,000.00; no discount, no refund; COGS 2 x 1,000 = 2,000.00.
    expect(profit.grossSalesMinor).toBe(500000n);
    expect(profit.netSalesMinor).toBe(500000n);
    expect(profit.cogsMinor).toBe(200000n);
    expect(profit.grossProfitMinor).toBe(300000n);
    // Contribution = 3,000.00 + 130.00 charged - 90.00 courier - 52.00 COD fee - 35.00 packaging.
    expect(profit.contributionMarginMinor).toBe(300000n + 13000n - 9000n - 5200n - 3500n);
    expect(profit.contributionMarginMinor).toBe(295300n);
    expect(profit.shippingCostMinor).toBe(9000n);
    expect(profit.codFeesMinor).toBe(5200n);
    expect(profit.packagingMinor).toBe(3500n);
    // 2,953.00 of 5,000.00 net sales = 59.06 %, shown with one decimal.
    expect(profit.marginBps).toBe(5906n);
    expect(formatMargin(profit.marginBps)).toBe('59.1 %');
  });

  it('subtracts order and line discounts from net sales', () => {
    const profit = computeOrderProfit({
      ...base,
      lines: [line(1, 250000n, 100000n, { discount: 10000n })],
      orderDiscountMinor: 20000n,
      shippingChargedMinor: 0n,
    });
    expect(profit.discountsMinor).toBe(30000n);
    expect(profit.netSalesMinor).toBe(220000n);
    expect(profit.grossProfitMinor).toBe(120000n);
    expect(profit.contributionMarginMinor).toBe(120000n);
  });

  it('a partial refund lowers net sales, a restocked return brings the cost of goods back', () => {
    const profit = computeOrderProfit({
      ...base,
      lines: [line(2, 250000n, 100000n, { restocked: 1 })],
      refundedMinor: 250000n,
    });
    // One shirt came back and was refunded: net 2,500.00, COGS only for the shirt that stayed.
    expect(profit.netSalesMinor).toBe(250000n);
    expect(profit.cogsMinor).toBe(100000n);
    expect(profit.grossProfitMinor).toBe(150000n);
    expect(profit.contributionMarginMinor).toBe(163000n);
  });

  it('a damaged return keeps its cost of goods: the loss stays with the order', () => {
    const profit = computeOrderProfit({
      ...base,
      lines: [line(2, 250000n, 100000n, { restocked: 0 })],
      refundedMinor: 250000n,
      costLines: [{ type: 'return_shipping', amountMinor: 8000n }],
    });
    expect(profit.cogsMinor).toBe(200000n);
    expect(profit.grossProfitMinor).toBe(250000n - 200000n);
    expect(profit.returnCostsMinor).toBe(8000n);
    expect(profit.contributionMarginMinor).toBe(50000n + 13000n - 8000n);
  });

  it('a parcel that went back to origin is a loss: courier cost, return fee, no revenue kept', () => {
    // Delivery failed, the goods were restocked, the customer's money was never collected.
    const profit = computeOrderProfit({
      lines: [line(1, 250000n, 100000n, { restocked: 1 })],
      orderDiscountMinor: 0n,
      shippingChargedMinor: 0n,
      refundedMinor: 250000n,
      costLines: [
        { type: 'shipping', amountMinor: 9000n },
        { type: 'rto_loss', amountMinor: 6000n },
        { type: 'packaging', amountMinor: 3500n },
      ],
      recognised: false,
    });
    expect(profit.netSalesMinor).toBe(0n);
    expect(profit.cogsMinor).toBe(0n);
    expect(profit.contributionMarginMinor).toBe(-(9000n + 6000n + 3500n));
    expect(profit.marginBps).toBeNull();
    expect(formatMargin(profit.marginBps)).toBe('n/a');
  });

  it('a replacement line from an exchange adds cost without adding sales', () => {
    const profit = computeOrderProfit({
      ...base,
      lines: [line(1, 250000n, 100000n, { restocked: 1 }), line(1, 0n, 110000n)],
    });
    expect(profit.grossSalesMinor).toBe(250000n);
    expect(profit.cogsMinor).toBe(110000n);
    expect(profit.grossProfitMinor).toBe(140000n);
  });

  it('gateway fees, other costs and reversing lines are all counted', () => {
    const profit = computeOrderProfit({
      ...base,
      costLines: [
        { type: 'gateway_fee', amountMinor: 7500n },
        { type: 'other', amountMinor: 2000n },
        { type: 'other', amountMinor: -500n },
      ],
    });
    expect(profit.gatewayFeesMinor).toBe(7500n);
    expect(profit.otherCostsMinor).toBe(1500n);
    expect(profit.contributionMarginMinor).toBe(300000n + 13000n - 7500n - 1500n);
  });

  it('works only on whole minor units and never produces fractions', () => {
    const profit = computeOrderProfit({
      ...base,
      lines: [line(3, 33333n, 11111n)],
      shippingChargedMinor: 0n,
    });
    expect(profit.grossSalesMinor).toBe(99999n);
    expect(profit.cogsMinor).toBe(33333n);
    expect(profit.marginBps).toBe(6667n);
    expect(formatMargin(profit.marginBps)).toBe('66.7 %');
  });

  it('formats a negative margin', () => {
    expect(formatMargin(-1250n)).toBe('-12.5 %');
    expect(formatMargin(0n)).toBe('0.0 %');
  });

  it('carries the recognition flag through', () => {
    expect(computeOrderProfit({ ...base, recognised: false }).recognised).toBe(false);
  });
});
