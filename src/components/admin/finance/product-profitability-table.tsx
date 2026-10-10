import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { ProductProfitabilityRow } from '@/modules/finance/types';

interface ProductProfitabilityTableProps {
  products: ProductProfitabilityRow[];
}

export function ProductProfitabilityTable({ products }: ProductProfitabilityTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-sm border border-line bg-raised p-4">
        <div>
          <h2 className="text-sm font-semibold text-fg">Product & Collection Margin Matrix</h2>
          <p className="text-xs text-fg-muted">
            Per-piece sales volume, landed cost of goods, return rates, and true gross contribution.
          </p>
        </div>
        <span className="text-xs text-fg-muted">
          Ranked by <strong className="text-fg">Gross Revenue</strong>
        </span>
      </div>

      <div className="overflow-hidden rounded-sm border border-line bg-raised">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-page/50 text-left text-fg-muted">
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Garment Piece</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Category</th>
                <th className="w-24 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Units Sold
                </th>
                <th className="w-24 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Return Rate
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Gross Sales
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  COGS
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Gross Profit
                </th>
                <th className="w-28 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-fg-muted">
                    No confirmed or delivered sales recorded yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const marginNum = Number(p.grossMarginPercent.replace('%', '')) || 0;
                  const marginTone =
                    marginNum >= 60 ? 'gold' : marginNum >= 40 ? 'neutral' : 'warning';

                  return (
                    <tr key={p.productId} className="transition-colors hover:bg-page/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-8 flex-shrink-0 overflow-hidden rounded-xs border border-line bg-page">
                            {p.thumbnailUrl ? (
                              <Image
                                src={p.thumbnailUrl}
                                alt={p.productTitle}
                                fill
                                sizes="32px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-surface-subtle" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-fg">{p.productTitle}</div>
                            <div className="text-xs text-fg-muted capitalize">{p.productType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted">{p.categoryName}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-fg">
                        {p.unitsSold}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-fg-muted">
                        {p.returnRatePercent}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap text-fg">
                        {p.grossRevenueFormatted}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap text-fg-muted">
                        {p.cogsFormatted}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-fg">
                        {p.grossProfitFormatted}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge tone={marginTone} className="font-mono font-bold">
                          {p.grossMarginPercent}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
