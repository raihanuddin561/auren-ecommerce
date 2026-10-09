import { db } from '@/lib/db';
import { money, serialize, type SerializedMoney } from '@/lib/money';
import * as catalog from '@/modules/catalog/service';
import * as inventory from '@/modules/inventory/service';
import { getVerificationSettings } from '@/modules/settings/service';
import type {
  QueueFilter,
  QueueResult,
  QueueRow,
  SellableHit,
  Viewer,
  Workspace,
} from './admin-types';
import { QUEUE_FILTERS } from './admin-types';
import * as repo from './repository';
import { claimIsActive, slaState } from './sla';
import { VERIFICATION_STATUSES } from './state-machine';
import { STATUS_LABEL, type OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

/**
 * Read models for the verification queue and workspace (DESIGN-SYSTEM 4.11). Reads only: every
 * change goes through the verification service.
 */

const PAYMENT_LABEL: Record<string, string> = {
  cod: 'Cash on delivery',
  sslcommerz: 'Card or mobile banking',
  stripe: 'Card',
  bkash: 'bKash',
};

export async function getVerificationQueue(
  filter: QueueFilter,
  viewer: Viewer,
  now: Date = new Date(),
): Promise<QueueResult> {
  const settings = await getVerificationSettings(db);
  const found = await repo.listQueue(db, { statuses: VERIFICATION_STATUSES });
  const assigneeIds = [
    ...new Set(found.map((row) => row.assignedTo).filter((id): id is string => !!id)),
  ];
  const names = new Map(
    (await repo.staffNames(db, assigneeIds)).map((member) => [member.id, member.user.name]),
  );

  const all = found.map((row): QueueRow => {
    const provider = row.payments[0]?.provider ?? 'cod';
    const prepaid = provider !== 'cod';
    const claimActive =
      row.assignedTo !== null &&
      (row.claimExpiresAt === null || claimIsActive(row.claimExpiresAt, now));
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      phone: row.phone,
      status: row.status as OrderStatus,
      statusLabel: STATUS_LABEL[row.status as OrderStatus],
      channel: row.channel,
      paymentLabel: PAYMENT_LABEL[provider] ?? provider,
      prepaid,
      total: serialize(money(row.totalMinor, row.currency)),
      itemCount: row._count.items,
      placedAt: row.placedAt.toISOString(),
      riskScore: row.riskScore,
      riskFlags: row.riskFlags,
      assignee: row.assignedTo
        ? { id: row.assignedTo, name: names.get(row.assignedTo) ?? 'Team member' }
        : null,
      lockedByOther: claimActive && row.assignedTo !== viewer.staffId,
      mine: row.assignedTo === viewer.staffId,
      attempts: row.verificationAttempts,
      nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
      callbackDue:
        row.status === 'on_hold' && (row.nextAttemptAt === null || row.nextAttemptAt <= now),
      needsManagerReview: row.needsManagerReview,
      sla: slaState(row.placedAt, now, settings),
    };
  });

  const matches: Record<QueueFilter, (row: QueueRow) => boolean> = {
    all: () => true,
    mine: (row) => row.mine,
    unassigned: (row) => row.assignee === null,
    on_hold: (row) => row.status === 'on_hold',
    overdue: (row) => row.sla.overdue,
    high_risk: (row) => row.riskScore >= 50,
    prepaid: (row) => row.prepaid,
    needs_review: (row) => row.needsManagerReview,
  };
  const counts = Object.fromEntries(
    QUEUE_FILTERS.map((name) => [name, all.filter(matches[name]).length]),
  ) as Record<QueueFilter, number>;
  return { rows: all.filter(matches[filter]), counts, settings };
}

// ---------------------------------------------------------------------------------------------
// One order in the workspace
// ---------------------------------------------------------------------------------------------

const digitsOnly = (phone: string) => phone.replace(/\D/g, '');

export function confirmationMessage(input: { name: string; orderNumber: string; total: string }) {
  const first = input.name.split(' ')[0] || input.name;
  return `Hi ${first}, this is AUREN confirming your order ${input.orderNumber} (${input.total}). Please reply YES to confirm or call us if you want to change anything.`;
}

export async function getVerificationWorkspace(
  orderId: string,
  viewer: Viewer,
  formatTotal: (value: SerializedMoney) => string,
  now: Date = new Date(),
): Promise<Workspace | null> {
  const order = await repo.findById(db, orderId);
  if (!order) return null;
  const settings = await getVerificationSettings(db);
  const status = order.status as OrderStatus;

  const [attempts, history, flags] = await Promise.all([
    repo.listAttempts(db, orderId),
    repo.ordersOfPhone(db, order.phone, order.id),
    repo.activeRiskFlags(db, order.phone, now),
  ]);
  const staffIds = [order.assignedTo, order.createdBy].filter((id): id is string => !!id);
  const names = new Map(
    (await repo.staffNames(db, staffIds)).map((member) => [member.id, member.user.name]),
  );

  const open = (VERIFICATION_STATUSES as readonly string[]).includes(status);
  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const siblingsByProduct = new Map<
    string,
    Array<{ variantId: string; label: string; available: number; price: SerializedMoney }>
  >();
  if (open) {
    for (const productId of productIds) {
      const ids = await catalog.liveVariantIdsOfProduct(db, productId);
      const [variants, availability] = await Promise.all([
        catalog.getSellableVariants(db, ids),
        inventory.getAvailability(ids),
      ]);
      siblingsByProduct.set(
        productId,
        ids.flatMap((variantId) => {
          const variant = variants.get(variantId);
          if (!variant?.sellable || variant.avgCostMinor <= 0n) return [];
          return [
            {
              variantId,
              label: variant.optionsLabel || variant.productTitle,
              available: availability.get(variantId)?.available ?? 0,
              price: serialize(money(variant.priceMinor, variant.currency)),
            },
          ];
        }),
      );
    }
  }
  const stock = await inventory.getAvailability(order.items.map((item) => item.variantId));

  const provider = order.payments[0]?.provider ?? 'cod';
  const address = order.shippingAddress as unknown as ShippingAddressSnapshot;
  const total = serialize(money(order.totalMinor, order.currency));
  const claimActive =
    order.assignedTo !== null &&
    (order.claimExpiresAt === null || claimIsActive(order.claimExpiresAt, now));
  const message = confirmationMessage({
    name: order.customerName,
    orderNumber: order.orderNumber,
    total: formatTotal(total),
  });
  const phoneDigits = digitsOnly(order.phone);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    statusLabel: STATUS_LABEL[status],
    placedAt: order.placedAt.toISOString(),
    channel: order.channel,
    createdByName: order.createdBy ? (names.get(order.createdBy) ?? null) : null,
    paymentLabel: PAYMENT_LABEL[provider] ?? provider,
    paymentStatus: order.paymentStatus,
    customer: { name: order.customerName, phone: order.phone, email: order.email },
    address,
    delivery: order.shippingMethod as unknown as ShippingMethodSnapshot,
    customerNote: order.customerNote,
    items: order.items.map((item) => ({
      itemId: item.id,
      variantId: item.variantId,
      productId: item.productId,
      title: item.titleSnapshot,
      variantLabel: item.variantTitleSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: serialize(money(item.unitPriceMinor, order.currency)),
      lineTotal: serialize(money(item.totalMinor, order.currency)),
      imageUrl: item.imageSnapshot,
      alternatives: siblingsByProduct.get(item.productId) ?? [],
      available: stock.get(item.variantId)?.available ?? 0,
    })),
    subtotal: serialize(money(order.subtotalMinor, order.currency)),
    shipping: serialize(money(order.shippingChargedMinor, order.currency)),
    total,
    risk: {
      score: order.riskScore,
      flags: order.riskFlags,
      onRecord: flags.map((flag) => flag.type),
    },
    history: history.map((past) => ({
      id: past.id,
      orderNumber: past.orderNumber,
      status: past.status,
      placedAt: past.placedAt.toISOString(),
      total: serialize(money(past.totalMinor, past.currency)),
    })),
    attempts: attempts.map((attempt) => ({
      at: attempt.createdAt.toISOString(),
      staffName: attempt.staff.user.name,
      channel: attempt.channel,
      outcome: attempt.outcome,
      note: attempt.note,
      nextAttemptAt: attempt.nextAttemptAt?.toISOString() ?? null,
    })),
    assignment: {
      assigneeName: order.assignedTo ? (names.get(order.assignedTo) ?? 'Team member') : null,
      assigneeId: order.assignedTo,
      claimExpiresAt: order.claimExpiresAt?.toISOString() ?? null,
      mine: order.assignedTo === viewer.staffId,
      lockedByOther: claimActive && order.assignedTo !== viewer.staffId && !viewer.manager,
    },
    sla: slaState(order.placedAt, now, settings),
    attemptCount: order.verificationAttempts,
    nextAttemptAt: order.nextAttemptAt?.toISOString() ?? null,
    needsManagerReview: order.needsManagerReview,
    contact: {
      telHref: `tel:${order.phone}`,
      smsHref: `sms:${order.phone}?body=${encodeURIComponent(message)}`,
      whatsappHref: `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`,
      message,
    },
    canEdit: open,
  };
}

/** Staff a manager can assign an order to. */
export async function listVerifierStaff() {
  const rows = await repo.verifierStaff(db);
  return rows;
}

/** Variants staff can put on an order: sellable, with a cost basis, matching a title or SKU. */
export async function searchSellableVariants(q: string): Promise<SellableHit[]> {
  const hits = await inventory.searchVariants(q);
  const ids = hits.map((hit) => hit.variantId);
  const [variants, availability] = await Promise.all([
    catalog.getSellableVariants(db, ids),
    inventory.getAvailability(ids),
  ]);
  return hits.flatMap((hit) => {
    const variant = variants.get(hit.variantId);
    if (!variant?.sellable || variant.avgCostMinor <= 0n) return [];
    return [
      {
        variantId: hit.variantId,
        label: hit.label,
        sku: hit.sku,
        available: availability.get(hit.variantId)?.available ?? 0,
        price: serialize(money(variant.priceMinor, variant.currency)),
      },
    ];
  });
}
