import type { Tx } from '@/lib/db';
import type { Money } from '@/lib/money';
import { getCodSettings } from '@/modules/settings/service';
import type {
  EligibilityContext,
  PaymentMethodOption,
  PaymentProviderId,
  PlacementPlan,
} from './provider';
import * as repo from './repository';
import { assertMethodAllowed, listMethods } from './registry';

/** The methods a customer can see for an order, with the reason when one is unavailable. */
export async function availableMethods(
  tx: Tx,
  input: { total: Money; deliveryAllowsCod: boolean },
): Promise<PaymentMethodOption[]> {
  return listMethods({ ...input, cod: await getCodSettings(tx) });
}

/** Refuses a method that is unknown or not allowed for this order (server-side, INV-M3 spirit). */
export async function planPlacement(
  tx: Tx,
  methodId: string,
  input: { total: Money; deliveryAllowsCod: boolean },
): Promise<{ providerId: PaymentProviderId; plan: PlacementPlan }> {
  const context: EligibilityContext = { ...input, cod: await getCodSettings(tx) };
  const provider = assertMethodAllowed(methodId, context);
  return { providerId: provider.id, plan: provider.plan() };
}

/** Writes the payment record that goes with a new order. */
export async function recordPayment(
  tx: Tx,
  input: {
    orderId: string;
    providerId: PaymentProviderId;
    plan: PlacementPlan;
    amount: Money;
  },
): Promise<void> {
  await repo.insertPayment(tx, {
    orderId: input.orderId,
    provider: input.providerId,
    method: input.plan.record.method,
    amountMinor: input.amount.minor,
    currency: input.amount.currency,
    status: input.plan.record.status,
    idempotencyKey: `order:${input.orderId}:${input.providerId}`,
  });
}
