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
 * Steadfast courier adapter (6.8), same contract as Pathao. Written from the public API
 * documentation (create_order, status_by_cid) and tested against a fake transport only; it has NOT
 * been run against a live merchant account.
 */

export interface SteadfastConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
}

/** Steadfast delivery_status to ours. Approval-pending states are not final, so they stay in transit. */
export function mapSteadfastStatus(text: string): ShipmentStatusId {
  const key = text.toLowerCase().trim();
  if (key === 'delivered' || key === 'partial_delivered') return 'delivered';
  if (key === 'cancelled' || key === 'hold') return 'failed';
  if (key === 'in_review' || key === 'pending') return 'booked';
  return 'in_transit';
}

export function createSteadfastCourier(
  config: SteadfastConfig,
  transport: HttpTransport,
): CourierProvider {
  const url = (path: string) => `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const headers = { 'Api-Key': config.apiKey, 'Secret-Key': config.secretKey };

  return {
    id: 'steadfast',
    label: 'Steadfast',
    mode: 'api',
    isConfigured: () => true,
    async book(request: BookingRequest): Promise<BookingResult> {
      const response = await transport.send({
        method: 'POST',
        url: url('/create_order'),
        headers,
        body: {
          invoice: request.orderNumber,
          recipient_name: request.recipient.name,
          recipient_phone: request.recipient.phone.replace(/^\+?88/, ''),
          recipient_address: request.recipient.address,
          cod_amount: Number(divideRound(request.codAmountMinor, 100n, 'up')),
          note: request.note ?? '',
        },
      });
      const consignment = (
        response.json as {
          consignment?: { consignment_id?: number | string; tracking_code?: string };
        } | null
      )?.consignment;
      if (response.status >= 500) throw new CourierError('Steadfast is not responding.', true);
      if (response.status !== 200 || !consignment?.consignment_id) {
        throw new CourierError('Steadfast did not accept the booking.', false);
      }
      return {
        consignmentId: String(consignment.consignment_id),
        trackingNumber: consignment.tracking_code ?? String(consignment.consignment_id),
        costMinor: null,
        labelUrl: null,
        status: 'booked',
      };
    },
    async fetchUpdates(parcel): Promise<CourierStatusUpdate[]> {
      const response = await transport.send({
        method: 'GET',
        url: url(`/status_by_cid/${encodeURIComponent(parcel.consignmentId)}`),
        headers,
      });
      const status = (response.json as { delivery_status?: string } | null)?.delivery_status;
      if (response.status >= 500) throw new CourierError('Steadfast is not responding.', true);
      if (response.status !== 200 || !status) return [];
      return [
        {
          externalId: `${parcel.consignmentId}:${status}`,
          status: mapSteadfastStatus(status),
          description: status.replaceAll('_', ' '),
          occurredAt: new Date(),
          raw: { delivery_status: status },
        },
      ];
    },
  };
}
