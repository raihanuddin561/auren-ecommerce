import 'server-only';
import { env } from '@/lib/env';
import { DomainError } from '@/lib/errors';
import { manualCourier } from './manual';
import { createPathaoCourier } from './pathao';
import { createSteadfastCourier } from './steadfast';
import { fetchTransport } from './transport';
import type { CourierId, CourierProvider, HttpTransport } from './types';

/**
 * Registered couriers. The manual courier always exists. Pathao and Steadfast appear only when their
 * keys are set, so a missing account never breaks fulfilment. Tests install fakes with
 * `setCouriersForTests`.
 */
export interface CourierOption {
  id: CourierId;
  label: string;
  mode: 'manual' | 'api';
  configured: boolean;
}

type CourierConfig = Pick<
  typeof env,
  | 'PATHAO_BASE_URL'
  | 'PATHAO_CLIENT_ID'
  | 'PATHAO_CLIENT_SECRET'
  | 'PATHAO_USERNAME'
  | 'PATHAO_PASSWORD'
  | 'PATHAO_STORE_ID'
  | 'STEADFAST_BASE_URL'
  | 'STEADFAST_API_KEY'
  | 'STEADFAST_SECRET_KEY'
>;

export function buildCouriers(
  config: CourierConfig,
  transport: HttpTransport,
): Partial<Record<CourierId, CourierProvider>> {
  const couriers: Partial<Record<CourierId, CourierProvider>> = { manual: manualCourier };
  if (
    config.PATHAO_CLIENT_ID &&
    config.PATHAO_CLIENT_SECRET &&
    config.PATHAO_USERNAME &&
    config.PATHAO_PASSWORD &&
    config.PATHAO_STORE_ID
  ) {
    couriers.pathao = createPathaoCourier(
      {
        baseUrl: config.PATHAO_BASE_URL,
        clientId: config.PATHAO_CLIENT_ID,
        clientSecret: config.PATHAO_CLIENT_SECRET,
        username: config.PATHAO_USERNAME,
        password: config.PATHAO_PASSWORD,
        storeId: config.PATHAO_STORE_ID,
      },
      transport,
    );
  }
  if (config.STEADFAST_API_KEY && config.STEADFAST_SECRET_KEY) {
    couriers.steadfast = createSteadfastCourier(
      {
        baseUrl: config.STEADFAST_BASE_URL,
        apiKey: config.STEADFAST_API_KEY,
        secretKey: config.STEADFAST_SECRET_KEY,
      },
      transport,
    );
  }
  return couriers;
}

let override: Partial<Record<CourierId, CourierProvider>> | null = null;

/** Tests install fake couriers here; pass null to go back to the real ones. */
export function setCouriersForTests(couriers: Partial<Record<CourierId, CourierProvider>> | null) {
  override = couriers;
}

const active = () => override ?? buildCouriers(env, fetchTransport);

export function getCourier(id: string): CourierProvider {
  const couriers = active();
  const courier = Object.hasOwn(couriers, id) ? couriers[id as CourierId] : undefined;
  if (!courier) {
    throw new DomainError('VALIDATION', 'That courier is not available.', {
      fieldErrors: { courier: ['Choose one of the couriers shown.'] },
    });
  }
  return courier;
}

/** Couriers staff can choose from: the manual one and every configured API courier. */
export function listCourierOptions(): CourierOption[] {
  const couriers = active();
  const order: CourierId[] = ['manual', 'pathao', 'steadfast'];
  return order.flatMap((id) => {
    const courier = couriers[id];
    return courier
      ? [{ id, label: courier.label, mode: courier.mode, configured: courier.isConfigured() }]
      : [];
  });
}
