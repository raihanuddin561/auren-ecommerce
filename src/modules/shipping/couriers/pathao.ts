import { divideRound } from '@/lib/money';
import {
  CourierError,
  type BookingRequest,
  type BookingResult,
  type CourierProvider,
  type CourierStatusUpdate,
  type HttpTransport,
  type ShipmentStatusId,
} from './types';

/**
 * Pathao Merchant API adapter (6.7). Written from the public documentation (issue-token, create
 * order, order info) and tested against a fake transport. It has NOT been run against a live
 * merchant account: the owner has none yet. Until it is, the booking screen offers it only when all
 * keys are configured, and the manual courier stays available beside it.
 */

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

/** Pathao status text to ours. Unknown text is treated as "in transit" rather than guessed as done. */
export function mapPathaoStatus(text: string): ShipmentStatusId {
  const key = text.toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (key === 'delivered' || key === 'partial delivery') return 'delivered';
  if (key.includes('delivery failed') || key === 'on hold') return 'failed';
  if (key.startsWith('return') || key === 'paid return' || key === 'exchange') return 'returned';
  if (key.includes('assigned for delivery') || key.includes('out for delivery')) {
    return 'out_for_delivery';
  }
  if (key.includes('picked up')) return 'picked_up';
  if (
    key.includes('pickup') ||
    key === 'pending' ||
    key === 'order created' ||
    key === 'order updated'
  ) {
    return 'booked';
  }
  return 'in_transit';
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

export function createPathaoCourier(
  config: PathaoConfig,
  transport: HttpTransport,
): CourierProvider {
  let cache: TokenCache | null = null;
  const url = (path: string) => `${config.baseUrl.replace(/\/$/, '')}${path}`;

  async function token(): Promise<string> {
    if (cache && cache.expiresAt > Date.now() + 60_000) return cache.token;
    const response = await transport.send({
      method: 'POST',
      url: url('/aladdin/api/v1/issue-token'),
      body: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        username: config.username,
        password: config.password,
        grant_type: 'password',
      },
    });
    const body = response.json as { access_token?: string; expires_in?: number } | null;
    if (response.status !== 200 || !body?.access_token) {
      throw new CourierError('Pathao refused the sign-in. Check the keys.', false);
    }
    cache = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return cache.token;
  }

  return {
    id: 'pathao',
    label: 'Pathao',
    mode: 'api',
    isConfigured: () => true,
    async book(request: BookingRequest): Promise<BookingResult> {
      const response = await transport.send({
        method: 'POST',
        url: url('/aladdin/api/v1/orders'),
        headers: { Authorization: `Bearer ${await token()}` },
        body: {
          store_id: Number(config.storeId),
          merchant_order_id: request.orderNumber,
          recipient_name: request.recipient.name,
          recipient_phone: request.recipient.phone.replace(/^\+?88/, ''),
          recipient_address: request.recipient.address,
          delivery_type: 48,
          item_type: 2,
          special_instruction: request.note ?? '',
          item_quantity: request.itemCount,
          item_weight: Math.max(0.5, (request.weightG ?? 500) / 1000),
          amount_to_collect: Number(divideRound(request.codAmountMinor, 100n, 'up')),
          item_description: `AUREN order ${request.orderNumber}`,
        },
      });
      const data = (
        response.json as { data?: { consignment_id?: string; delivery_fee?: number } } | null
      )?.data;
      if (response.status >= 500) throw new CourierError('Pathao is not responding.', true);
      if (response.status !== 200 || !data?.consignment_id) {
        throw new CourierError('Pathao did not accept the booking.', false);
      }
      return {
        consignmentId: data.consignment_id,
        trackingNumber: data.consignment_id,
        costMinor:
          typeof data.delivery_fee === 'number'
            ? BigInt(Math.round(data.delivery_fee * 100))
            : null,
        labelUrl: null,
        status: 'booked',
      };
    },
    async fetchUpdates(parcel): Promise<CourierStatusUpdate[]> {
      const response = await transport.send({
        method: 'GET',
        url: url(`/aladdin/api/v1/orders/${encodeURIComponent(parcel.consignmentId)}/info`),
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const data = (
        response.json as { data?: { order_status?: string; updated_at?: string } } | null
      )?.data;
      if (response.status >= 500) throw new CourierError('Pathao is not responding.', true);
      if (response.status !== 200 || !data?.order_status) return [];
      return [
        {
          externalId: `${parcel.consignmentId}:${data.order_status}`,
          status: mapPathaoStatus(data.order_status),
          description: data.order_status,
          occurredAt: data.updated_at ? new Date(data.updated_at) : new Date(),
          raw: data,
        },
      ];
    },
  };
}
