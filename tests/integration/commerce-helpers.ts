import { db } from '@/lib/db';
import { receive } from '@/modules/inventory/service';
import { ensureReferenceData } from '@/modules/shipping/service';

let counter = 0;

export interface MadeVariant {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
}

export interface MakeVariantOptions {
  title?: string;
  priceMinor?: bigint;
  costMinor?: bigint;
  stock?: number;
  /** Draft products cannot be bought. */
  published?: boolean;
  size?: string;
}

/** A published product with one Size-option variant, optionally with stock received into the default location. */
export async function makeSellableVariant(options: MakeVariantOptions = {}): Promise<MadeVariant> {
  const n = ++counter;
  const title = options.title ?? `Test shirt ${n}`;
  const sku = `TST-${Date.now().toString(36)}-${n}`;
  const product = await db.product.create({
    data: {
      slug: `test-shirt-${Date.now().toString(36)}-${n}`,
      title,
      status: options.published === false ? 'draft' : 'active',
      publishedAt: options.published === false ? null : new Date(Date.now() - 60_000),
      options: {
        create: {
          name: 'Size',
          position: 0,
          values: { create: { value: options.size ?? 'm', label: options.size ?? 'M' } },
        },
      },
      media: { create: { url: '/seed/sand.svg', alt: `${title} in sand`, provider: 'static' } },
    },
    include: { options: { include: { values: true } } },
  });
  const variant = await db.productVariant.create({
    data: {
      productId: product.id,
      sku,
      priceMinor: options.priceMinor ?? 250000n,
      avgCostMinor: options.costMinor ?? 100000n,
      optionValues: { create: { optionValueId: product.options[0]!.values[0]!.id } },
    },
  });
  await ensureLocation();
  if ((options.stock ?? 0) > 0) {
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: variant.id,
        quantity: options.stock!,
        unitCostMinor: options.costMinor ?? 100000n,
        referenceType: 'test',
        referenceId: `seed-${variant.id}`,
      }),
    );
  }
  return { productId: product.id, variantId: variant.id, sku, title };
}

export async function ensureLocation(): Promise<void> {
  const found = await db.location.findFirst({ where: { isDefault: true } });
  if (!found) await db.location.create({ data: { name: 'Main', isDefault: true } });
}

/** Delivery areas and the two default zones (the same data the seed installs). */
export async function seedDelivery(): Promise<void> {
  await db.$transaction((tx) => ensureReferenceData(tx), { timeout: 60_000 });
}

/** Ids of Dhaka > Dhaka > Mirpur and of Chattogram > Chattogram, for address inputs. */
export async function areaIds() {
  const code = (c: string) => db.geoArea.findUniqueOrThrow({ where: { code: c } });
  const [dhaka, dhakaDistrict, mirpur, chattogram, chattogramDistrict, comilla] = await Promise.all(
    [
      code('dhaka'),
      code('dhaka/dhaka'),
      code('dhaka/dhaka/mirpur'),
      code('chattogram'),
      code('chattogram/chattogram'),
      code('chattogram/cumilla'),
    ],
  );
  return {
    dhaka: { divisionId: dhaka.id, districtId: dhakaDistrict.id, thanaId: mirpur.id },
    chattogram: { divisionId: chattogram.id, districtId: chattogramDistrict.id, thanaId: null },
    cumilla: { divisionId: chattogram.id, districtId: comilla.id, thanaId: null },
  };
}
