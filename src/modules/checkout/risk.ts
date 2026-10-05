import { DomainError } from '@/lib/errors';
import { compare, money, type Money } from '@/lib/money';
import type { CheckoutProtection } from '@/modules/settings/schemas';

/**
 * Checkout abuse rules (4.8) as pure functions over counts that the order service reads inside the
 * placement transaction. Stock held by orders that wait for staff cannot be hoarded (INV-O11): there
 * is no automatic release (INV-O2), so the caps are the protection, and a staff cancellation is the
 * release valve.
 */

export interface VelocityCounts {
  openByPhone: number;
  dayByPhone: number;
  everByPhone: number;
  openByAddress: number;
  dayByIp: number;
  heldUnits: ReadonlyMap<string, number>;
}

/** Flags that stop an order online. Other flags only raise the order's risk score for staff. */
export const BLOCKING_FLAGS: ReadonlySet<string> = new Set(['fake_order', 'repeat_rto', 'abusive']);

export const BLOCKED_MESSAGE =
  'We are unable to take this order online. Please message our concierge and we will help you.';

export const isBlocked = (flags: readonly string[]): boolean =>
  flags.some((flag) => BLOCKING_FLAGS.has(flag));

const WAIT_MESSAGE =
  'You already have orders waiting for our confirmation. Please wait for our call, or message our concierge if you want to change one.';

export function assertWithinLimits(
  counts: VelocityCounts,
  limits: CheckoutProtection,
  lines: ReadonlyArray<{ variantId: string; quantity: number; label: string }>,
): void {
  if (counts.openByPhone >= limits.maxOpenOrdersPerPhone) {
    throw new DomainError('RATE_LIMITED', WAIT_MESSAGE);
  }
  if (counts.dayByPhone >= limits.maxOrdersPerPhonePerDay) {
    throw new DomainError(
      'RATE_LIMITED',
      'There have been several orders from this number today. Please try again tomorrow or message our concierge.',
    );
  }
  if (counts.openByAddress >= limits.maxOpenOrdersPerAddress) {
    throw new DomainError('RATE_LIMITED', WAIT_MESSAGE);
  }
  if (counts.dayByIp >= limits.maxOrdersPerIpPerDay) {
    throw new DomainError(
      'RATE_LIMITED',
      'There have been several orders from this connection today. Please try again later or message our concierge.',
    );
  }
  for (const line of lines) {
    const held = counts.heldUnits.get(line.variantId) ?? 0;
    if (held + line.quantity > limits.maxUnitsPerVariantPerPhone) {
      throw new DomainError(
        'RATE_LIMITED',
        `${line.label} is limited to ${limits.maxUnitsPerVariantPerPhone} pieces per customer while earlier orders are being confirmed.`,
      );
    }
  }
}

export interface RiskAssessment {
  score: number;
  flags: string[];
}

/** First-order, high-value and repeat signals for the verification team. Never blocks an order. */
export function assessRisk(input: {
  counts: VelocityCounts;
  total: Money;
  flagsOnRecord: readonly string[];
}): RiskAssessment {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, points: number) => {
    flags.push(flag);
    score += points;
  };
  if (input.counts.everByPhone === 0) add('first_order', 10);
  if (compare(input.total, money(1_500_000n, input.total.currency)) >= 0) add('high_value', 20);
  if (input.counts.dayByPhone >= 1) add('repeat_today', 15);
  if (input.counts.openByPhone >= 1) add('open_order_exists', 10);
  if (input.flagsOnRecord.length > 0) add('flag_on_record', 30);
  return { score: Math.min(100, score), flags };
}
