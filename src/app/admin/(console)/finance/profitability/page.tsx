import type { Metadata } from 'next';
import { requireStaff } from '@/lib/staff';
import { ProductProfitabilityTable } from '@/components/admin/finance/product-profitability-table';
import { getProductProfitabilityForAdmin } from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Product Profitability | Finance' };

export default async function ProfitabilityPage() {
  await requireStaff();
  const products = await getProductProfitabilityForAdmin(100);

  return <ProductProfitabilityTable products={products} />;
}
