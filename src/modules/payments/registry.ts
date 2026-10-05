import { DomainError } from '@/lib/errors';
import { codProvider } from './cod';
import type {
  EligibilityContext,
  PaymentMethodOption,
  PaymentProvider,
  PaymentProviderId,
} from './provider';

/**
 * Registered providers. Adding a gateway is one entry here plus its adapter; an id that is not
 * registered cannot be selected, whatever a client sends.
 */
const PROVIDERS: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  cod: codProvider,
};

export const registeredProviderIds = (): PaymentProviderId[] =>
  Object.keys(PROVIDERS) as PaymentProviderId[];

export function getPaymentProvider(id: string): PaymentProvider {
  // Own keys only: "constructor" and "__proto__" are not payment methods.
  const provider = Object.hasOwn(PROVIDERS, id)
    ? (PROVIDERS as Record<string, PaymentProvider | undefined>)[id]
    : undefined;
  if (!provider) {
    throw new DomainError('VALIDATION', 'That payment method is not available.', {
      fieldErrors: { paymentMethod: ['Choose one of the available payment methods.'] },
    });
  }
  return provider;
}

/** Every registered method with whether this order may use it. */
export function listMethods(context: EligibilityContext): PaymentMethodOption[] {
  return Object.values(PROVIDERS)
    .filter((provider): provider is PaymentProvider => provider !== undefined)
    .map((provider) => {
      const eligibility = provider.checkEligibility(context);
      return {
        id: provider.id,
        label: provider.label,
        description: provider.description,
        available: eligibility.available,
        ...(eligibility.available ? {} : { reason: eligibility.reason }),
      };
    });
}

/** Throws a clear error unless the method is registered and allowed for this order. */
export function assertMethodAllowed(id: string, context: EligibilityContext): PaymentProvider {
  const provider = getPaymentProvider(id);
  const eligibility = provider.checkEligibility(context);
  if (!eligibility.available) {
    throw new DomainError('VALIDATION', eligibility.reason, {
      fieldErrors: { paymentMethod: [eligibility.reason] },
    });
  }
  return provider;
}
