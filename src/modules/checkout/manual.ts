import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { runIdempotent } from '@/lib/idempotency';
import { newId } from '@/lib/ids';
import { add, zero } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import { lineLabel, resolveLines } from '@/modules/orders/placement';
import * as orders from '@/modules/orders/service';
import type { ManualOrderInput } from '@/modules/orders/schemas';
import type { ShippingAddressSnapshot } from '@/modules/orders/types';
import { getPaymentProvider } from '@/modules/payments/registry';
import * as shipping from '@/modules/shipping/service';
import { assessRisk } from './risk';
import { chooseOption, fingerprintAddress, requirePhone } from './service';

/**
 * Manual order entry (6.5): staff type in an order from a phone call, Facebook, Instagram or
 * WhatsApp conversation. It uses the same rules as the website (prices and costs from the database,
 * stock through the inventory service, delivery from the rates table) and the order is born
 * `placed` with its channel, in the same verification queue. The creator cannot confirm it
 * themselves unless the owner turned that on in settings (see verification.ts).
 *
 * Staff entry skips the customer-facing limits (phone codes, orders per phone and address): a
 * person is already on the line with the customer. The risk signals are still computed and shown.
 * Cash on delivery is the payment method; its customer-facing maximum does not apply to a staff
 * decision, which the verification step then confirms with the customer.
 */

export interface ManualOrderStaff {
  /** staff_members.id */
  staffId: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ManualOrderResult {
  orderId: string;
  orderNumber: string;
  tags: string[];
  replayed: boolean;
}

export async function placeManualOrder(
  staff: ManualOrderStaff,
  input: ManualOrderInput,
): Promise<ManualOrderResult> {
  const phone = requirePhone(input.contact.phone);
  const contactEmail = input.contact.email?.trim() || null;
  const orderId = newId();
  const request = {
    channel: input.channel,
    contact: { name: input.contact.name, phone, email: contactEmail },
    address: input.address,
    lines: input.lines,
    shippingRateId: input.shippingRateId ?? null,
    customerNote: input.customerNote ?? null,
  };

  const result = await runIdempotent(
    db,
    { key: input.idempotencyKey, scope: 'orders.manual', actor: staff.staffId, request },
    async (tx) => {
      await orders.lockPhone(tx, phone);
      const area = await shipping.resolveArea(tx, {
        divisionId: input.address.divisionId,
        districtId: input.address.districtId,
        divisionName: input.address.divisionName,
        districtName: input.address.districtName,
        thanaId: input.address.thanaId ?? null,
        thanaName: input.address.thanaName,
      });
      const thanaName =
        area.thana?.name ??
        input.address.thanaName?.trim() ??
        input.address.area.trim() ??
        'General';

      const currency = 'BDT';
      const lines = await resolveLines(
        tx,
        input.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        { currency },
      );
      const subtotal = orders.totalsFor(lines, currency, zero(currency)).subtotal;
      const quote = await shipping.quoteDelivery(tx, area, subtotal);
      const option = chooseOption(quote.options, input.shippingRateId);
      const total = add(subtotal, option.charge);
      const provider = getPaymentProvider('cod');

      const address: ShippingAddressSnapshot = {
        fullName: input.contact.name,
        phone,
        division: area.division,
        district: area.district,
        thana: { id: area.thana?.id ?? null, name: thanaName },
        area: input.address.area,
        line1: input.address.line1,
        line2: input.address.line2 ?? null,
        postalCode: input.address.postalCode ?? null,
        country: 'BD',
      };
      const addressHash = fingerprintAddress(address);
      const counts = await orders.velocitySnapshot(tx, {
        phone,
        addressHash,
        ipHash: null,
        variantIds: lines.map((line) => line.variant.id),
        now: new Date(),
      });
      const risk = assessRisk({
        counts,
        total,
        flagsOnRecord: await orders.activeRiskFlags(tx, phone),
      });

      const placed = await orders.createPlaced(tx, {
        orderId,
        channel: input.channel,
        createdBy: staff.staffId,
        userId: null,
        contact: { name: input.contact.name, phone, email: contactEmail },
        address,
        addressHash,
        ipHash: null,
        customerNote: input.customerNote ?? null,
        lines,
        currency,
        delivery: { zoneId: quote.zoneId, zoneName: quote.zoneName, option },
        providerId: provider.id,
        plan: provider.plan(),
        risk,
      });
      await audit(tx, {
        actorId: staff.userId,
        action: 'order.create_manual',
        entity: 'order',
        entityId: orderId,
        after: {
          channel: input.channel,
          lines: lines.map((line) => `${lineLabel(line.variant)} x ${line.quantity}`),
          totalMinor: total.minor.toString(),
        },
        ip: staff.ip ?? null,
        userAgent: staff.userAgent ?? null,
      });
      return placed;
    },
  );
  if (!result.value) throw new DomainError('INTERNAL', 'The order could not be placed.');
  return {
    orderId: result.value.orderId,
    orderNumber: result.value.orderNumber,
    tags: result.value.tags,
    replayed: result.replayed,
  };
}
