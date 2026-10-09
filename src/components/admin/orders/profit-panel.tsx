import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import type { OrderProfitView } from '@/modules/finance/types';
import { formatMargin } from '@/modules/finance/profit';
import { AddCostForm } from './add-cost-form';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});

const COST_LABEL: Record<string, string> = {
  shipping: 'Courier charge',
  gateway_fee: 'Payment gateway fee',
  cod_fee: 'Cash collection fee',
  packaging: 'Packaging',
  return_shipping: 'Return shipping',
  rto_loss: 'Loss on a parcel sent back',
  other: 'Other',
};

type Money = Parameters<typeof deserialize>[0];
const money = (value: Money) => formatPrice(deserialize(value));

/**
 * The cost and profit of one order (11.5, 11.6): the formula of ARCHITECTURE section 7.2, line by
 * line, then every cost line with where it came from. Shown only to staff who may see cost.
 */
export function ProfitPanel({
  orderId,
  profit,
  canAddCost,
}: {
  orderId: string;
  profit: OrderProfitView;
  canAddCost: boolean;
}) {
  const f = profit.figures;
  const margin = profit.marginBps === null ? null : BigInt(profit.marginBps);
  const contributionNegative = BigInt(f.contributionMargin.minor) < 0n;
  const rows: Array<{
    label: string;
    value: Money;
    sign?: '-' | '+';
    strong?: boolean;
    hint?: string;
  }> = [
    { label: 'Gross sales', value: f.grossSales },
    { label: 'Discounts', value: f.discounts, sign: '-' },
    { label: 'Refunds', value: f.refunds, sign: '-' },
    { label: 'Net sales', value: f.netSales, strong: true },
    {
      label: 'Cost of goods',
      value: f.cogs,
      sign: '-',
      hint: 'From the cost saved on each line when it was sold.',
    },
    { label: 'Gross profit', value: f.grossProfit, strong: true },
    { label: 'Delivery charged to the customer', value: f.shippingCharged, sign: '+' },
    { label: 'Courier charge', value: f.shippingCost, sign: '-' },
    { label: 'Payment gateway fees', value: f.gatewayFees, sign: '-' },
    { label: 'Cash collection fees', value: f.codFees, sign: '-' },
    { label: 'Packaging', value: f.packaging, sign: '-' },
    { label: 'Returns and parcels sent back', value: f.returnCosts, sign: '-' },
    { label: 'Other costs', value: f.otherCosts, sign: '-' },
    { label: 'Contribution margin', value: f.contributionMargin, strong: true },
  ];

  return (
    <section aria-labelledby="profit-heading" className="border border-line bg-raised p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="profit-heading" className="type-h3 text-fg">
          Cost and profit
        </h2>
        <p
          className={cn(
            'type-admin tabular-nums',
            contributionNegative ? 'font-medium text-danger-text' : 'text-fg',
          )}
        >
          {money(f.contributionMargin)} · margin {formatMargin(margin)}
        </p>
      </div>
      <p className="mb-4 type-small text-fg-muted">
        {profit.recognised
          ? 'Delivered: the sale is counted.'
          : 'Not delivered yet: these figures are what the order will earn if it is delivered. The sale counts when it is delivered.'}
      </p>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              'flex items-baseline justify-between gap-4 border-b border-line py-1.5 type-admin last:border-b-0',
              row.strong && 'font-medium text-fg',
            )}
          >
            <dt className={cn(!row.strong && 'text-fg-muted')}>
              {row.label}
              {row.hint ? (
                <span className="block type-small font-normal text-fg-muted">{row.hint}</span>
              ) : null}
            </dt>
            <dd className="tabular-nums">
              {row.sign && BigInt(row.value.minor) !== 0n ? `${row.sign} ` : ''}
              {money(row.value)}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 mb-2 type-eyebrow text-fg-muted">Cost lines</h3>
      {profit.costLines.length === 0 ? (
        <p className="type-small text-fg-muted">
          No costs recorded yet. The courier charge and packaging are added when the parcel is
          booked.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 type-small">
          {profit.costLines.map((line, index) => (
            <li key={`${line.createdAt}-${index}`} className="flex justify-between gap-3">
              <span className="text-fg-muted">
                {COST_LABEL[line.type] ?? line.type}
                {line.note ? ` (${line.note})` : ''} · {dateTime.format(new Date(line.createdAt))}
              </span>
              <span className="text-fg tabular-nums">{money(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {canAddCost ? <AddCostForm orderId={orderId} /> : null}
    </section>
  );
}
