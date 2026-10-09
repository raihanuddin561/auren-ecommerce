import { describe, expect, it } from 'vitest';
import { isDomainError } from '@/lib/errors';
import { createFakeTransport } from '../couriers/fake-transport';
import { manualCourier } from '../couriers/manual';
import { createPathaoCourier, mapPathaoStatus } from '../couriers/pathao';
import { buildCouriers } from '../couriers/registry';
import { createSteadfastCourier, mapSteadfastStatus } from '../couriers/steadfast';
import { CourierError, type BookingRequest } from '../couriers/types';

const request: BookingRequest = {
  orderNumber: 'AUR-100001',
  recipient: { name: 'Ayaan Rahman', phone: '+8801712345678', address: 'House 4, Road 2, Mirpur' },
  codAmountMinor: 275050n,
  currency: 'BDT',
  itemCount: 2,
  weightG: null,
  note: 'Call before delivery',
};

describe('manual courier', () => {
  it('books with the courier name and tracking number staff typed', async () => {
    const result = await manualCourier.book({
      ...request,
      manual: { courierName: 'Sundarban', trackingNumber: ' SB-12345 ', costMinor: 9000n },
    });
    expect(result).toMatchObject({
      consignmentId: null,
      trackingNumber: 'SB-12345',
      costMinor: 9000n,
      status: 'booked',
    });
  });

  it('refuses a booking without a courier name or tracking number', async () => {
    for (const manual of [
      undefined,
      { courierName: '', trackingNumber: 'X1', costMinor: 0n },
      { courierName: 'Own rider', trackingNumber: '  ', costMinor: 0n },
    ]) {
      try {
        await manualCourier.book({ ...request, ...(manual ? { manual } : {}) });
        expect.unreachable();
      } catch (error) {
        expect(isDomainError(error) && error.code).toBe('VALIDATION');
      }
    }
  });
});

describe('Pathao adapter (fake transport, not verified against a live account)', () => {
  const config = {
    baseUrl: 'https://pathao.test',
    clientId: 'id',
    clientSecret: 'secret',
    username: 'user@example.com',
    password: 'pw',
    storeId: '777',
  };

  it('signs in once, books a parcel and returns the consignment and the fee', async () => {
    const { transport, requests } = createFakeTransport({
      'POST /aladdin/api/v1/issue-token': {
        status: 200,
        json: { access_token: 'tok', expires_in: 3600 },
      },
      'POST /aladdin/api/v1/orders': {
        status: 200,
        json: { data: { consignment_id: 'PT-9', delivery_fee: 85 } },
      },
    });
    const courier = createPathaoCourier(config, transport);
    const first = await courier.book(request);
    await courier.book(request);
    expect(first).toMatchObject({
      consignmentId: 'PT-9',
      trackingNumber: 'PT-9',
      costMinor: 8500n,
    });
    // One token request for two bookings.
    expect(requests.filter((r) => r.url.endsWith('/issue-token'))).toHaveLength(1);
    const booking = requests.find((r) => r.url.endsWith('/orders'));
    expect(booking?.headers).toEqual({ Authorization: 'Bearer tok' });
    expect(booking?.body).toMatchObject({
      store_id: 777,
      merchant_order_id: 'AUR-100001',
      recipient_phone: '01712345678',
      // 2,750.50 collected rounds up to a whole taka for the courier.
      amount_to_collect: 2751,
      item_quantity: 2,
    });
  });

  it('reports a refused login and a courier outage differently', async () => {
    const denied = createPathaoCourier(
      config,
      createFakeTransport({ 'POST /aladdin/api/v1/issue-token': { status: 401, json: {} } })
        .transport,
    );
    await expect(denied.book(request)).rejects.toMatchObject({ retryable: false });
    const down = createPathaoCourier(
      config,
      createFakeTransport({
        'POST /aladdin/api/v1/issue-token': { status: 200, json: { access_token: 't' } },
        'POST /aladdin/api/v1/orders': { status: 503, json: null },
      }).transport,
    );
    await expect(down.book(request)).rejects.toBeInstanceOf(CourierError);
    await expect(down.book(request)).rejects.toMatchObject({ retryable: true });
  });

  it('reads the parcel status and keeps an update id so polling twice stores it once', async () => {
    const { transport } = createFakeTransport({
      'POST /aladdin/api/v1/issue-token': { status: 200, json: { access_token: 't' } },
      'GET /aladdin/api/v1/orders/PT-9/info': {
        status: 200,
        json: { data: { order_status: 'Delivered', updated_at: '2026-10-08T10:00:00Z' } },
      },
    });
    const courier = createPathaoCourier(config, transport);
    const [update] = await courier.fetchUpdates!({ consignmentId: 'PT-9', trackingNumber: 'PT-9' });
    expect(update).toMatchObject({ externalId: 'PT-9:Delivered', status: 'delivered' });
    const [again] = await courier.fetchUpdates!({ consignmentId: 'PT-9', trackingNumber: 'PT-9' });
    expect(again?.externalId).toBe(update?.externalId);
  });

  it('maps courier status text to shipment statuses and never guesses "delivered"', () => {
    expect(mapPathaoStatus('Delivered')).toBe('delivered');
    expect(mapPathaoStatus('Delivery Failed')).toBe('failed');
    expect(mapPathaoStatus('Return')).toBe('returned');
    expect(mapPathaoStatus('Assigned for Delivery')).toBe('out_for_delivery');
    expect(mapPathaoStatus('Picked Up')).toBe('picked_up');
    expect(mapPathaoStatus('Pickup Requested')).toBe('booked');
    expect(mapPathaoStatus('At the Sorting HUB')).toBe('in_transit');
    expect(mapPathaoStatus('something new')).toBe('in_transit');
  });
});

describe('Steadfast adapter (fake transport, not verified against a live account)', () => {
  const config = { baseUrl: 'https://steadfast.test/api/v1', apiKey: 'key', secretKey: 'secret' };

  it('books a parcel with the API keys in headers', async () => {
    const { transport, requests } = createFakeTransport({
      'POST /create_order': {
        status: 200,
        json: { status: 200, consignment: { consignment_id: 1234, tracking_code: 'SF-TRACK' } },
      },
    });
    const result = await createSteadfastCourier(config, transport).book(request);
    expect(result).toMatchObject({
      consignmentId: '1234',
      trackingNumber: 'SF-TRACK',
      costMinor: null,
    });
    expect(requests[0]?.headers).toEqual({ 'Api-Key': 'key', 'Secret-Key': 'secret' });
    expect(requests[0]?.body).toMatchObject({ invoice: 'AUR-100001', cod_amount: 2751 });
  });

  it('refuses an unaccepted booking and reads the status', async () => {
    const refused = createSteadfastCourier(
      config,
      createFakeTransport({ 'POST /create_order': { status: 422, json: { errors: {} } } })
        .transport,
    );
    await expect(refused.book(request)).rejects.toMatchObject({ retryable: false });
    const { transport } = createFakeTransport({
      'GET /status_by_cid/1234': {
        status: 200,
        json: { status: 200, delivery_status: 'delivered' },
      },
    });
    const [update] = await createSteadfastCourier(config, transport).fetchUpdates!({
      consignmentId: '1234',
      trackingNumber: 'SF-TRACK',
    });
    expect(update?.status).toBe('delivered');
  });

  it('maps statuses', () => {
    expect(mapSteadfastStatus('delivered')).toBe('delivered');
    expect(mapSteadfastStatus('delivered_approval_pending')).toBe('in_transit');
    expect(mapSteadfastStatus('cancelled')).toBe('failed');
    expect(mapSteadfastStatus('in_review')).toBe('booked');
  });
});

describe('courier registry', () => {
  const none = {
    PATHAO_BASE_URL: 'https://p.test',
    STEADFAST_BASE_URL: 'https://s.test',
  } as Parameters<typeof buildCouriers>[0];
  const { transport } = createFakeTransport({});

  it('always has the manual courier and only adds API couriers when their keys are set', () => {
    expect(Object.keys(buildCouriers(none, transport))).toEqual(['manual']);
    const some = buildCouriers(
      { ...none, STEADFAST_API_KEY: 'k', STEADFAST_SECRET_KEY: 's' },
      transport,
    );
    expect(Object.keys(some).sort()).toEqual(['manual', 'steadfast']);
    // Pathao needs every one of its five values.
    const partial = buildCouriers(
      { ...none, PATHAO_CLIENT_ID: 'x', PATHAO_CLIENT_SECRET: 'y' },
      transport,
    );
    expect(partial.pathao).toBeUndefined();
    const all = buildCouriers(
      {
        ...none,
        PATHAO_CLIENT_ID: 'a',
        PATHAO_CLIENT_SECRET: 'b',
        PATHAO_USERNAME: 'c',
        PATHAO_PASSWORD: 'd',
        PATHAO_STORE_ID: 'e',
      },
      transport,
    );
    expect(all.pathao?.id).toBe('pathao');
  });
});
