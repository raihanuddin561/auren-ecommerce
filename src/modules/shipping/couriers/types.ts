/**
 * The courier contract (6.7, 6.8). A courier books a parcel and reports its progress. Three
 * providers implement it: `manual` (staff type the courier name and tracking number and update the
 * status themselves, fully working with no account), and `pathao` and `steadfast` (API bookings,
 * enabled only when their keys are set). Orders and the fulfilment service never depend on a
 * particular courier: they depend on this interface.
 */

export type CourierId = 'pathao' | 'steadfast' | 'manual';

export type ShipmentStatusId =
  | 'pending'
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface BookingRequest {
  /** AUR-100001: the courier's merchant reference for this parcel. */
  orderNumber: string;
  recipient: {
    name: string;
    /** E.164 with the country code, as stored on the order. */
    phone: string;
    /** One line the rider can read: house, road, area, thana, district. */
    address: string;
  };
  /** Cash to collect on delivery, in minor units (0 for a prepaid order). */
  codAmountMinor: bigint;
  currency: string;
  itemCount: number;
  weightG: number | null;
  note: string | null;
  /** Only for the manual courier: what staff typed. */
  manual?: {
    courierName: string;
    trackingNumber: string;
    costMinor: bigint;
  };
}

export interface BookingResult {
  /** The courier's own id for the parcel (consignment id). Null for the manual courier. */
  consignmentId: string | null;
  trackingNumber: string;
  /** What the courier charged, when it says so; staff enter it otherwise. */
  costMinor: bigint | null;
  labelUrl: string | null;
  status: 'booked';
}

export interface CourierStatusUpdate {
  /** The courier's id for this update, so polling the same update twice stores it once. */
  externalId: string;
  status: ShipmentStatusId;
  description: string | null;
  occurredAt: Date;
  raw: unknown;
}

/** A small HTTP port, so adapters are tested with a fake and never touch the network in tests. */
export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}
export interface HttpResponse {
  status: number;
  json: unknown;
}
export interface HttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export interface CourierProvider {
  readonly id: CourierId;
  readonly label: string;
  /** `manual`: staff update statuses. `api`: the courier reports them. */
  readonly mode: 'manual' | 'api';
  /** Whether it can be used right now (keys present). */
  isConfigured(): boolean;
  book(request: BookingRequest): Promise<BookingResult>;
  /** Progress reported by the courier. Absent for the manual courier. */
  fetchUpdates?(parcel: {
    consignmentId: string;
    trackingNumber: string;
  }): Promise<CourierStatusUpdate[]>;
}

export class CourierError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'CourierError';
  }
}
