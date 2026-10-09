import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { runIdempotent } from '@/lib/idempotency';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { add, money, serialize, zero } from '@/lib/money';
import { hmacHex } from '@/lib/order-secret';
import { normalizeBdPhone, maskPhone } from '@/lib/phone';
import { SmsUnavailableError, sendSms } from '@/integrations/sms';
import * as cart from '@/modules/cart/service';
import type { CartIdentity } from '@/modules/cart/types';
import * as inventory from '@/modules/inventory/service';
import { lineLabel, resolveLines } from '@/modules/orders/placement';
import * as orders from '@/modules/orders/service';
import { safeEqual } from '@/modules/orders/tracking';
import type { ShippingAddressSnapshot } from '@/modules/orders/types';
import * as payments from '@/modules/payments/service';
import { formatEta, type DeliveryOption } from '@/modules/shipping/quote';
import * as shipping from '@/modules/shipping/service';
import * as settings from '@/modules/settings/service';
import {
  generateOtpCode,
  hashOtp,
  otpIdentifier,
  otpMessage,
  otpProofIdentifier,
  OTP_PROOF_TTL_MS,
  OTP_TTL_MS,
} from './otp';
import * as repo from './repository';
import type { CheckoutSummary, DeliveryOptionView } from './types';
import type { PlaceOrderInput, QuoteInput } from './schemas';
import { assertWithinLimits, assessRisk, BLOCKED_MESSAGE, isBlocked } from './risk';

// ---------------------------------------------------------------------------------------------
// What the checkout page shows: the bag, delivery options, payment methods, totals
// ---------------------------------------------------------------------------------------------

export type { CheckoutSummary, DeliveryOptionView };

const optionView = (option: DeliveryOption): DeliveryOptionView => ({
  rateId: option.rateId,
  name: option.name,
  charge: serialize(option.charge),
  listed: serialize(option.listed),
  free: option.free,
  eta: formatEta(option.minDays, option.maxDays),
  codAllowed: option.codAllowed,
});

export function chooseOption(
  options: DeliveryOption[],
  rateId: string | undefined,
): DeliveryOption {
  const chosen = rateId ? options.find((option) => option.rateId === rateId) : undefined;
  if (rateId && !chosen) {
    throw new DomainError('VALIDATION', 'That delivery option is not available for your address.', {
      fieldErrors: { shippingRateId: ['Choose one of the delivery options shown.'] },
    });
  }
  return chosen ?? options[0]!;
}

/** The bag with delivery and payment worked out for an address (or without one yet). */
export async function summarize(
  identity: CartIdentity,
  selection: QuoteInput | null,
): Promise<CheckoutSummary> {
  const view = await cart.getView(identity);
  const protection = await settings.getCheckoutProtection(db);
  const subtotal = money(BigInt(view.subtotal.minor), view.currency);
  if (!selection) {
    return {
      cart: view,
      delivery: null,
      methods: await payments.availableMethods(db, { total: subtotal, deliveryAllowsCod: true }),
      totals: { subtotal: view.subtotal, shipping: null, total: null },
      otpRequired: protection.otpRequired,
    };
  }
  const area = await shipping.resolveArea(db, selection);
  const quote = await shipping.quoteDelivery(db, area, subtotal);
  const option = chooseOption(quote.options, selection.shippingRateId);
  const total = add(subtotal, option.charge);
  return {
    cart: view,
    delivery: {
      zoneName: quote.zoneName,
      options: quote.options.map(optionView),
      selectedRateId: option.rateId,
    },
    methods: await payments.availableMethods(db, { total, deliveryAllowsCod: option.codAllowed }),
    totals: {
      subtotal: view.subtotal,
      shipping: serialize(option.charge),
      total: serialize(total),
    },
    otpRequired: protection.otpRequired,
  };
}

// ---------------------------------------------------------------------------------------------
// Phone codes (optional, off by default)
// ---------------------------------------------------------------------------------------------

export function requirePhone(input: string): string {
  const phone = normalizeBdPhone(input);
  if (!phone) {
    throw new DomainError(
      'VALIDATION',
      'Enter a Bangladesh mobile number, for example 01712 345678.',
      {
        fieldErrors: {
          'contact.phone': ['Enter a Bangladesh mobile number, for example 01712 345678.'],
        },
      },
    );
  }
  return phone;
}

/** Sends a six digit code by SMS. Does nothing (and says so) when codes are switched off. */
export async function requestOtp(
  phoneInput: string,
): Promise<{ sent: boolean; required: boolean }> {
  const protection = await settings.getCheckoutProtection(db);
  if (!protection.otpRequired) return { sent: false, required: false };
  const phone = requirePhone(phoneInput);
  if (isBlocked(await orders.activeRiskFlags(db, phone))) {
    throw new DomainError('FORBIDDEN', BLOCKED_MESSAGE);
  }
  const code = generateOtpCode();
  await repo.replaceVerification(
    db,
    otpIdentifier(phone),
    hashOtp(phone, code),
    new Date(Date.now() + OTP_TTL_MS),
  );
  try {
    await sendSms({
      to: phone,
      text: otpMessage(code),
      idempotencyKey: `otp:${phone}:${Date.now()}`,
    });
  } catch (error) {
    await repo.deleteVerifications(db, otpIdentifier(phone));
    if (error instanceof SmsUnavailableError) {
      logger.error(
        { phone: maskPhone(phone) },
        'phone code requested but no SMS gateway is configured',
      );
      throw new DomainError(
        'CONFLICT',
        'We cannot send codes right now. Please try again later or message our concierge.',
      );
    }
    throw error;
  }
  return { sent: true, required: true };
}

/** Checks the code. A right code marks the phone verified for 30 minutes; a wrong one changes nothing. */
export async function verifyOtp(phoneInput: string, code: string): Promise<void> {
  const phone = requirePhone(phoneInput);
  const row = await repo.findVerification(db, otpIdentifier(phone));
  const bad = new DomainError(
    'VALIDATION',
    'That code is not right or has expired. Request a new one.',
    {
      fieldErrors: { otp: ['That code is not right or has expired.'] },
    },
  );
  if (!row || row.expiresAt < new Date()) {
    if (row) await repo.deleteVerifications(db, otpIdentifier(phone));
    throw bad;
  }
  if (!safeEqual(row.value, hashOtp(phone, code))) throw bad;
  await db.$transaction(async (tx) => {
    await repo.deleteVerifications(tx, otpIdentifier(phone));
    await repo.replaceVerification(
      tx,
      otpProofIdentifier(phone),
      'verified',
      new Date(Date.now() + OTP_PROOF_TTL_MS),
    );
  });
}

/** Spends the "phone verified" proof inside the order transaction. */
async function consumeOtpProof(tx: Tx, phone: string): Promise<void> {
  const row = await repo.findVerification(tx, otpProofIdentifier(phone));
  if (!row || row.expiresAt < new Date()) {
    throw new DomainError(
      'VALIDATION',
      'Please confirm your phone number with the code we sent you.',
      {
        fieldErrors: { otp: ['Please confirm your phone number with the code we sent you.'] },
      },
    );
  }
  await repo.deleteVerifications(tx, otpProofIdentifier(phone));
}

// ---------------------------------------------------------------------------------------------
// Placing the order
// ---------------------------------------------------------------------------------------------

export interface SubmitContext {
  ip: string | null;
}

export interface SubmitResult {
  orderId: string;
  orderNumber: string;
  /** The private tracking token for the confirmation page (derived, never stored). */
  trackingToken: string;
  /** Stock cache tags to invalidate. */
  tags: string[];
  /** True when this was a repeat of an order already placed with the same key. */
  replayed: boolean;
}

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Fingerprint of the delivery address, to limit orders that arrive at one address (INV-O11). */
export const fingerprintAddress = (address: ShippingAddressSnapshot): string =>
  hmacHex(
    'address:v1',
    [
      address.district.id,
      squash(address.thana.name),
      squash(address.area),
      squash(address.line1),
      squash(address.line2 ?? ''),
    ].join('|'),
  );

/**
 * Turns the bag into an order, once. The idempotency key is claimed in the same transaction as the
 * work, so a double click, a retry after a lost response and two tabs all end with ONE order and
 * the same answer. Everything that matters is decided inside the transaction from database rows:
 * prices and costs, delivery fee, whether cash on delivery is allowed, stock, and the per-phone
 * and per-address limits.
 */
export async function submit(
  identity: CartIdentity,
  input: PlaceOrderInput,
  context: SubmitContext,
): Promise<SubmitResult> {
  const phone = requirePhone(input.contact.phone);
  const actor = cart.actorKey(identity);
  if (!actor) throw new DomainError('VALIDATION', 'Your bag is empty.');

  if (isBlocked(await orders.activeRiskFlags(db, phone))) {
    throw new DomainError('FORBIDDEN', BLOCKED_MESSAGE);
  }

  const contactEmail = input.contact.email?.trim() || null;
  const orderId = newId();
  const ipHash = context.ip ? hmacHex('ip:v1', context.ip) : null;
  // The request fingerprint covers what the customer entered, not the bag: after a successful
  // placement the bag is empty, and a replay must still find its stored answer.
  const request = {
    contact: { name: input.contact.name, phone, email: contactEmail },
    address: input.address,
    shippingRateId: input.shippingRateId ?? null,
    paymentMethod: input.paymentMethod,
    customerNote: input.customerNote ?? null,
  };

  // Variants refused for lack of a cost basis. The checkout transaction rolls back, so staff are
  // told afterwards, outside it (see reportNoCostRefusal).
  const noCostVariantIds: string[] = [];
  const result = await runIdempotent(
    db,
    { key: input.idempotencyKey, scope: 'checkout.submit', actor, request },
    async (tx) => {
      // One checkout per phone at a time: the limits below are then exact, not approximate.
      await orders.lockPhone(tx, phone);
      const protection = await settings.getCheckoutProtection(tx);
      if (protection.otpRequired) await consumeOtpProof(tx, phone);

      const bag = await cart.loadForCheckout(tx, identity);
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
        input.address.area?.trim() ??
        'General';

      // Prices and costs come from the database, locked inside this transaction (INV-M3, INV-O5).
      const ids = bag.lines.map((line) => line.variantId);
      const lines = await resolveLines(
        tx,
        bag.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        { currency: bag.currency, onNoCost: (variantId) => noCostVariantIds.push(variantId) },
      );

      const subtotal = orders.totalsFor(lines, bag.currency, zero(bag.currency)).subtotal;
      const quote = await shipping.quoteDelivery(tx, area, subtotal);
      const option = chooseOption(quote.options, input.shippingRateId);
      const total = add(subtotal, option.charge);
      const { providerId, plan } = await payments.planPlacement(tx, input.paymentMethod, {
        total,
        deliveryAllowsCod: option.codAllowed,
      });

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
        ipHash,
        variantIds: ids,
        now: new Date(),
      });
      assertWithinLimits(
        counts,
        protection,
        lines.map((line) => ({
          variantId: line.variant.id,
          quantity: line.quantity,
          label: lineLabel(line.variant),
        })),
      );
      const risk = assessRisk({
        counts,
        total,
        flagsOnRecord: await orders.activeRiskFlags(tx, phone),
      });

      const placed = await orders.createPlaced(tx, {
        orderId,
        userId: identity.userId,
        contact: { name: input.contact.name, phone, email: contactEmail },
        address,
        addressHash,
        ipHash,
        customerNote: input.customerNote ?? null,
        lines,
        currency: bag.currency,
        delivery: { zoneId: quote.zoneId, zoneName: quote.zoneName, option },
        providerId,
        plan,
        risk,
      });
      await cart.clearCart(tx, bag.cartId);
      return placed;
    },
  ).catch(async (error: unknown) => {
    if (noCostVariantIds.length > 0) await inventory.reportNoCostRefusal(noCostVariantIds);
    throw error;
  });

  return {
    orderId: result.value.orderId,
    orderNumber: result.value.orderNumber,
    trackingToken: orders.trackingTokenFor(result.value.orderId),
    tags: result.value.tags,
    replayed: result.replayed,
  };
}
