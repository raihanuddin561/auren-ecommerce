import type { SerializedMoney } from '@/lib/money';
import type { OrderProfitView } from '@/modules/finance/types';
import type { VerificationSettings } from '@/modules/settings/schemas';
import type { SlaState } from './sla';
import type { OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

/**
 * The shapes the admin screens read (order list, order page, verification queue and workspace).
 * Pure types and constants, so pages and components can share them without reaching into services.
 */

export interface CourierOptionView {
  id: 'pathao' | 'steadfast' | 'manual';
  label: string;
  mode: 'manual' | 'api';
  configured: boolean;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  statusLabel: string;
  awaitingVerification: boolean;
  paymentStatus: string;
  channel: string;
  total: SerializedMoney;
  placedAt: string;
  itemCount: number;
  riskFlags: string[];
}

export const ORDER_PAYMENT_FILTERS = [
  'unpaid',
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
] as const;
export const ORDER_CHANNEL_FILTERS = [
  'web',
  'manual',
  'facebook',
  'instagram',
  'whatsapp',
  'store',
] as const;

export interface AdminOrderListParams {
  status?: OrderStatus | 'awaiting_verification' | 'ready_to_ship';
  q?: string;
  page: number;
  payment?: (typeof ORDER_PAYMENT_FILTERS)[number];
  channel?: (typeof ORDER_CHANNEL_FILTERS)[number];
  /** A staff_members.id, or "unassigned". The page turns "mine" into the viewer's id. */
  assignee?: string;
  /** Inclusive Dhaka calendar days, yyyy-mm-dd. */
  from?: string;
  to?: string;
}

export const QUEUE_FILTERS = [
  'all',
  'mine',
  'unassigned',
  'on_hold',
  'overdue',
  'high_risk',
  'prepaid',
  'needs_review',
] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];

export const FILTER_LABEL: Readonly<Record<QueueFilter, string>> = {
  all: 'All',
  mine: 'Mine',
  unassigned: 'Unassigned',
  on_hold: 'On hold',
  overdue: 'Overdue',
  high_risk: 'High risk',
  prepaid: 'Prepaid',
  needs_review: 'Needs manager',
};

export interface Viewer {
  /** staff_members.id */
  staffId: string;
  manager: boolean;
}

export interface QueueRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  statusLabel: string;
  channel: string;
  paymentLabel: string;
  prepaid: boolean;
  total: SerializedMoney;
  itemCount: number;
  placedAt: string;
  riskScore: number;
  riskFlags: string[];
  assignee: { id: string; name: string } | null;
  /** Someone holds the order right now (an active claim or a manager's assignment). */
  lockedByOther: boolean;
  mine: boolean;
  attempts: number;
  nextAttemptAt: string | null;
  callbackDue: boolean;
  needsManagerReview: boolean;
  sla: SlaState;
}

export interface QueueResult {
  rows: QueueRow[];
  counts: Record<QueueFilter, number>;
  settings: VerificationSettings;
}

export interface WorkspaceItem {
  itemId: string;
  variantId: string;
  productId: string;
  title: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPrice: SerializedMoney;
  lineTotal: SerializedMoney;
  imageUrl: string | null;
  /** Other sizes and colours of the same product, with what can be sold, for the inline swap. */
  alternatives: Array<{
    variantId: string;
    label: string;
    available: number;
    price: SerializedMoney;
  }>;
  available: number;
}

export interface WorkspaceAttempt {
  at: string;
  staffName: string;
  channel: string;
  outcome: string;
  note: string | null;
  nextAttemptAt: string | null;
}

export interface Workspace {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  placedAt: string;
  channel: string;
  createdByName: string | null;
  paymentLabel: string;
  paymentStatus: string;
  customer: { name: string; phone: string; email: string | null };
  address: ShippingAddressSnapshot;
  delivery: ShippingMethodSnapshot;
  customerNote: string | null;
  items: WorkspaceItem[];
  subtotal: SerializedMoney;
  shipping: SerializedMoney;
  total: SerializedMoney;
  risk: { score: number; flags: string[]; onRecord: string[] };
  history: Array<{
    id: string;
    orderNumber: string;
    status: string;
    placedAt: string;
    total: SerializedMoney;
  }>;
  attempts: WorkspaceAttempt[];
  assignment: {
    assigneeName: string | null;
    assigneeId: string | null;
    claimExpiresAt: string | null;
    mine: boolean;
    lockedByOther: boolean;
  };
  sla: SlaState;
  attemptCount: number;
  nextAttemptAt: string | null;
  needsManagerReview: boolean;
  /** Pre-written messages with links that open the phone's calling, SMS or WhatsApp app. */
  contact: { telHref: string; smsHref: string; whatsappHref: string; message: string };
  canEdit: boolean;
}

export interface SellableHit {
  variantId: string;
  label: string;
  sku: string;
  available: number;
  price: SerializedMoney;
}

export interface DetailItem {
  id: string;
  title: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  quantityReturned: number;
  unitPrice: SerializedMoney;
  /** Cost of goods at the time of sale; null for staff who may not see cost. */
  unitCost: SerializedMoney | null;
  lineTotal: SerializedMoney;
  imageUrl: string | null;
  isReplacement: boolean;
}

export interface DetailShipment {
  id: string;
  kind: string;
  courier: string;
  courierLabel: string;
  courierName: string | null;
  trackingNumber: string | null;
  status: string;
  /** Courier charges: null for staff who may not see cost. */
  cost: SerializedMoney | null;
  codFee: SerializedMoney | null;
  codAmount: SerializedMoney;
  bookedAt: string | null;
  deliveredAt: string | null;
  events: Array<{ status: string; description: string | null; at: string }>;
}

export interface DetailRefund {
  id: string;
  amount: SerializedMoney;
  status: string;
  method: string;
  reason: string;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface DetailReturn {
  id: string;
  returnNumber: string;
  type: string;
  status: string;
  resolution: string | null;
  customerNote: string | null;
  staffNote: string | null;
  createdAt: string;
  returnShipping: SerializedMoney | null;
  value: SerializedMoney;
  items: Array<{
    id: string;
    title: string;
    variantLabel: string;
    quantity: number;
    reason: string;
    condition: string | null;
    exchangeVariantLabel: string | null;
  }>;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  awaitingVerification: boolean;
  channel: string;
  placedAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  customer: { name: string; phone: string; email: string | null };
  address: ShippingAddressSnapshot;
  delivery: ShippingMethodSnapshot;
  customerNote: string | null;
  items: DetailItem[];
  subtotal: SerializedMoney;
  discount: SerializedMoney;
  shipping: SerializedMoney;
  total: SerializedMoney;
  paid: SerializedMoney;
  refunded: SerializedMoney;
  /** What can still be refunded (paid, less refunded, less requested). */
  refundable: SerializedMoney;
  paymentStatus: string;
  payments: Array<{
    provider: string;
    method: string;
    status: string;
    amount: SerializedMoney;
    createdAt: string;
  }>;
  refunds: DetailRefund[];
  returns: DetailReturn[];
  shipments: DetailShipment[];
  attempts: Array<{
    at: string;
    staffName: string;
    channel: string;
    outcome: string;
    note: string | null;
  }>;
  events: Array<{
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
    note: string | null;
    staffName: string | null;
  }>;
  riskScore: number;
  riskFlags: string[];
  /** Cost and profit: null for staff who may not see cost. */
  profit: OrderProfitView | null;
  couriers: CourierOptionView[];
  packaging: Array<{ id: string; name: string; cost: SerializedMoney; isDefault: boolean }>;
  returnWindow: { days: number; endsAt: string | null; open: boolean };
  pendingReplacements: number;
}
