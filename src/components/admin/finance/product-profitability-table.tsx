import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { ProductProfitabilityRow } from '@/modules/finance/types';

interface ProductProfitabilityTableProps {
  products: ProductProfitabilityRow[];
}

export function ProductProfitabilityTable({ products }: ProductProfitabilityTableProps) {
  return (
    <div className="space-y-4">
      <div className="bg-canvas flex items-center justify-between rounded-sm border border-line p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Product & Collection Margin Matrix</h2>
          <p className="text-stone text-xs">
            Per-piece sales volume, landed cost of goods, return rates, and true gross contribution.
          </p>
        </div>
        <span className="text-stone text-xs">
          Ranked by <strong className="text-ink">Gross Revenue</strong>
        </span>
      </div>

      <div className="bg-canvas overflow-hidden rounded-sm border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface/50 text-stone border-b border-line text-left">
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
                  <td colSpan={8} className="text-stone py-8 text-center">
                    No confirmed or delivered sales recorded yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const marginNum = Number(p.grossMarginPercent.replace('%', '')) || 0;
                  const marginTone =
                    marginNum >= 60 ? 'gold' : marginNum >= 40 ? 'neutral' : 'warning';

                  return (
                    <tr key={p.productId} className="hover:bg-surface/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="bg-surface relative h-10 w-8 flex-shrink-0 overflow-hidden rounded-xs border border-line">
                            {p.thumbnailUrl ? (
                              <Image
                                src={p.thumbnailUrl}
                                alt={p.productTitle}
                                fill
                                sizes="32px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="bg-surface-subtle h-full w-full" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-ink">{p.productTitle}</div>
                            <div className="text-stone text-xs capitalize">{p.productType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-stone px-4 py-2.5">{p.categoryName}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-ink">
                        {p.unitsSold}
                      </td>
                      <td className="text-stone px-4 py-2.5 text-right font-mono">
                        {p.returnRatePercent}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap text-ink">
                        {p.grossRevenueFormatted}
                      </td>
                      <td className="text-stone px-4 py-2.5 text-right font-mono whitespace-nowrap">
                        {p.cogsFormatted}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-ink">
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
