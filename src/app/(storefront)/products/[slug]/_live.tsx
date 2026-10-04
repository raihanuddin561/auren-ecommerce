import 'server-only';
import { cache } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { BuyBox } from '@/components/storefront/pdp/buy-box';
import { toDecimalString, money } from '@/lib/money';
import { productJsonLd } from '@/lib/seo/jsonld';
import { getLivePriceRows } from '@/modules/catalog/queries';
import { buildLive, type PdpData } from '@/modules/catalog/pdp';
import { getVariantAvailability } from '@/modules/inventory/queries';

/**
 * Live price and stock for one product. Read on every request, never cached: the cached shell
 * around it keeps the page fast, and a stock or price change shows here without waiting for it.
 */
const loadLive = cache(async (product: PdpData) => {
  const rows = await getLivePriceRows(product.id);
  const availability = await getVariantAvailability(rows.map((row) => row.id));
  return { rows, live: buildLive(rows, availability) };
});

/** The buy box with live price and units. Streams in inside a Suspense boundary. */
export async function LiveBuyBox({ product }: { product: PdpData }) {
  const { live } = await loadLive(product);
  return (
    <BuyBox
      productId={product.id}
      title={product.title}
      colors={product.colors}
      sizes={product.sizes}
      variants={product.variants}
      live={live}
      sizeChart={product.sizeChart}
    />
  );
}

/** Product, Offer and BreadcrumbList structured data with the live price and availability. */
export async function LiveStructuredData({ product }: { product: PdpData }) {
  const { rows, live } = await loadLive(product);
  const skuById = new Map(product.variants.map((variant) => [variant.id, variant.sku]));
  const stock = new Map(live.variants.map((variant) => [variant.id, variant.available]));
  return (
    <JsonLd
      data={productJsonLd({
        name: product.title,
        description: product.description[0] ?? product.subtitle,
        path: `/products/${product.slug}`,
        images: product.images.slice(0, 6).map((image) => image.url),
        category: product.breadcrumb.length > 2 ? (product.breadcrumb.at(-2)?.name ?? null) : null,
        offers: rows.map((row) => ({
          sku: skuById.get(row.id) ?? row.id,
          price: toDecimalString(money(row.priceMinor, row.currency)),
          priceMinor: row.priceMinor,
          currency: row.currency,
          inStock: (stock.get(row.id) ?? 0) > 0,
        })),
        breadcrumb: product.breadcrumb.map((crumb, index, all) => ({
          name: crumb.name,
          ...(index === all.length - 1 ? {} : { path: crumb.href }),
        })),
      })}
    />
  );
}
