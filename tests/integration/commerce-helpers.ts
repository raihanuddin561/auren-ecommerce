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

// ---------------------------------------------------------------------------------------------
// Orders: place one through the real checkout, and act as staff
// ---------------------------------------------------------------------------------------------

let phoneCounter = Math.floor(Math.random() * 8_000_000);
export const nextPhone = () => `0171${String(++phoneCounter).padStart(7, '0')}`;

export interface PlaceTestOrderOptions {
  variant: MadeVariant;
  quantity?: number;
  phone?: string;
  email?: string | null;
}

/** An order placed through the real checkout service (cash on delivery, Dhaka, Mirpur). */
export async function placeTestOrder(options: PlaceTestOrderOptions) {
  const { addLine } = await import('@/modules/cart/service');
  const { submit } = await import('@/modules/checkout/service');
  const areas = await areaIds();
  const added = await addLine(
    { userId: null, token: null },
    { variantId: options.variant.variantId, quantity: options.quantity ?? 1 },
  );
  const result = await submit(
    { userId: null, token: added.newToken },
    {
      idempotencyKey: `test-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      contact: {
        name: 'Ayaan Rahman',
        phone: options.phone ?? nextPhone(),
        ...(options.email === null ? {} : { email: options.email ?? 'ayaan@example.com' }),
      },
      address: {
        divisionId: areas.dhaka.divisionId,
        districtId: areas.dhaka.districtId,
        thanaId: areas.dhaka.thanaId,
        area: 'Section 10',
        line1: `House ${Math.floor(Math.random() * 90000)}, Road 4`,
      },
      paymentMethod: 'cod',
    },
    { ip: null },
  );
  return result;
}

export const fullChecklist = {
  genuine: true,
  items: true,
  address: true,
  payment: true,
  stock: true,
} as const;

/** What the action layer builds from a signed-in staff member. */
export function verifierOf(
  member: { id: string; userId: string },
  extra: { manager?: boolean; canVerify?: boolean; canCancel?: boolean } = {},
) {
  return {
    staffId: member.id,
    userId: member.userId,
    manager: extra.manager ?? false,
    canVerify: extra.canVerify ?? true,
    canCancel: extra.canCancel ?? true,
    ip: null,
    userAgent: null,
  };
}

// ---------------------------------------------------------------------------------------------
// A delivered order, through the real services
// ---------------------------------------------------------------------------------------------

export interface DeliveredOrder {
  orderId: string;
  variant: MadeVariant;
  fulfiller: { staffId: string; userId: string; ip: null; userAgent: null };
  staff: { staffId: string; userId: string; ip: null; userAgent: null };
  verifier: ReturnType<typeof verifierOf>;
  shipmentId: string;
}

/** Places, confirms, ships (manual courier, 90 taka) and delivers an order of `quantity` units. */
export async function deliveredOrder(
  options: {
    quantity?: number;
    stock?: number;
    priceMinor?: bigint;
    costMinor?: bigint;
    variant?: MadeVariant;
    phone?: string;
  } = {},
): Promise<DeliveredOrder> {
  const { db } = await import('@/lib/db');
  const { makeStaff } = await import('../factories');
  const { confirmOrder } = await import('@/modules/orders/verification');
  const { shipOrder, applyParcelUpdate } = await import('@/modules/orders/fulfilment');
  const variant =
    options.variant ??
    (await makeSellableVariant({
      stock: options.stock ?? 10,
      priceMinor: options.priceMinor ?? 250000n,
      costMinor: options.costMinor ?? 100000n,
    }));
  const placed = await placeTestOrder({
    variant,
    quantity: options.quantity ?? 2,
    ...(options.phone ? { phone: options.phone } : {}),
  });
  const verifierMember = await makeStaff({ role: 'order_verifier' });
  const fulfillerMember = await makeStaff({ role: 'fulfillment' });
  const verifier = verifierOf(verifierMember.member);
  await db.$transaction((tx) =>
    confirmOrder(tx, {
      orderId: placed.orderId,
      checklist: fullChecklist,
      channel: 'call',
      verifier,
    }),
  );
  const fulfiller = {
    staffId: fulfillerMember.member.id,
    userId: fulfillerMember.member.userId,
    ip: null,
    userAgent: null,
  } as const;
  await shipOrder({
    orderId: placed.orderId,
    courier: 'manual',
    courierName: 'Sundarban',
    trackingNumber: `SB-${Math.floor(Math.random() * 1e6)}`,
    costMinor: 9000n,
    fulfiller,
  });
  const shipment = await db.shipment.findFirstOrThrow({ where: { orderId: placed.orderId } });
  await db.$transaction((tx) =>
    applyParcelUpdate(tx, {
      orderId: placed.orderId,
      shipmentId: shipment.id,
      status: 'delivered',
      actor: { kind: 'staff', fulfiller },
    }),
  );
  return {
    orderId: placed.orderId,
    variant,
    fulfiller,
    staff: fulfiller,
    verifier,
    shipmentId: shipment.id,
  };
}
