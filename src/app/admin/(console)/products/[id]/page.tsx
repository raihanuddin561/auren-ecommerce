import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { DetailsForm } from '@/components/admin/catalog/products/details-form';
import { MediaSection } from '@/components/admin/catalog/products/media-section';
import { publishReadiness } from '@/components/admin/catalog/products/product-status';
import { ProductStatusBadge } from '@/components/admin/catalog/products/status-badge';
import { StatusPanel } from '@/components/admin/catalog/products/status-panel';
import { VariantsSection } from '@/components/admin/catalog/products/variants-section';
import { Button } from '@/components/ui/button';
import { canSeeCostOfGoods, hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import {
  getProductForAdmin,
  listCategoryOptions,
  listSizeChartOptions,
} from '@/modules/catalog/queries';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  const staff = await requireStaffWith('catalog.read');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const canSeeCost = canSeeCostOfGoods(staff);
  const canSeeStock = hasPermission(staff, 'inventory.read');
  const [product, categories, sizeCharts] = await Promise.all([
    getProductForAdmin(id, { includeCost: canSeeCost }),
    listCategoryOptions(),
    listSizeChartOptions(),
  ]);
  if (!product) notFound();

  const canWrite = hasPermission(staff, 'catalog.write');
  const canPublish = hasPermission(staff, 'catalog.publish');

  return (
    <>
      <PageHeader
        title={product.title}
        breadcrumb={[{ label: 'Products', href: '/admin/products' }, { label: product.title }]}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <ProductStatusBadge status={product.status} />
            <span className="type-small text-fg-muted">/products/{product.slug}</span>
          </span>
        }
        actions={
          canPublish ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="#status">Status and publishing</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-6">
        <DetailsForm
          product={product}
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
          sizeCharts={sizeCharts}
          canWrite={canWrite}
        />
        <VariantsSection
          product={product}
          sizeCharts={sizeCharts}
          canWrite={canWrite}
          showCost={canSeeCost}
          canSeeStock={canSeeStock}
        />
        <MediaSection product={product} canWrite={canWrite} />
        <StatusPanel
          productId={product.id}
          status={product.status}
          readiness={publishReadiness(product)}
          noCostVariants={product.variants
            .filter((v) => v.status !== 'archived' && !v.hasCost)
            .map((v) => v.labels.filter(Boolean).join(' / ') || v.sku)}
          canPublish={canPublish}
        />
      </div>
    </>
  );
}
