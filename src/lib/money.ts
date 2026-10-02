/**
 * Money is always an integer count of minor units (poisha, cents) plus an ISO 4217 currency.
 * No floats anywhere: INV-M1. All arithmetic, rounding and allocation goes through this file: INV-M2.
 */

export type RoundingMode =
  /** Banker's rounding: ties go to the even neighbour. Default for tax. */
  | 'half-even'
  /** Ties go away from zero. */
  | 'half-up'
  /** Truncate toward zero. */
  | 'down'
  /** Away from zero whenever there is any remainder. */
  | 'up';

export type MoneyErrorCode =
  | 'CURRENCY_MISMATCH'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'DIVISION_BY_ZERO'
  | 'OVERFLOW'
  | 'INVALID_ALLOCATION';

export class MoneyError extends Error {
  constructor(
    public readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MoneyError';
  }
}

export interface Money {
  readonly minor: bigint;
  readonly currency: string;
}

/** JSON-safe shape for storing or sending money (bigint is not JSON serializable). */
export interface SerializedMoney {
  readonly minor: string;
  readonly currency: string;
}

const INT64_MAX = 9_223_372_036_854_775_807n;
const INT64_MIN = -9_223_372_036_854_775_808n;
const BPS_DENOMINATOR = 10_000n;

const exponentCache = new Map<string, number>();

let knownCurrencies: Set<string> | undefined;

function assertCurrency(currency: string): string {
  knownCurrencies ??= new Set(Intl.supportedValuesOf('currency'));
  if (!knownCurrencies.has(currency)) {
    throw new MoneyError('INVALID_CURRENCY', `Unknown currency code: ${String(currency)}`);
  }
  return currency;
}

/** Number of decimal places the currency uses (BDT 2, JPY 0, KWD 3). */
export function exponent(currency: string): number {
  assertCurrency(currency);
  const cached = exponentCache.get(currency);
  if (cached !== undefined) return cached;
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits!;
  exponentCache.set(currency, digits);
  return digits;
}

function toBigInt(value: bigint | number | string, what: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError('INVALID_AMOUNT', `${what} must be a safe integer, got ${value}`);
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new MoneyError('INVALID_AMOUNT', `${what} must be an integer string, got "${value}"`);
  }
  return BigInt(value);
}

/** Builds Money from minor units. Numbers must be safe integers; strings must be integer text. */
export function money(minor: bigint | number | string, currency: string): Money {
  exponent(currency);
  const amount = toBigInt(minor, 'Amount');
  if (amount > INT64_MAX || amount < INT64_MIN) {
    throw new MoneyError('OVERFLOW', 'Amount does not fit in a 64-bit integer column');
  }
  return Object.freeze({ minor: amount, currency });
}

export const zero = (currency: string): Money => money(0n, currency);

export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Money>;
  return typeof candidate.minor === 'bigint' && typeof candidate.currency === 'string';
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError('CURRENCY_MISMATCH', `Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export const negate = (a: Money): Money => money(-a.minor, a.currency);

export const abs = (a: Money): Money => (a.minor < 0n ? negate(a) : a);

/** Sums a list. The currency is required so an empty list still yields a typed zero. */
export function sum(items: readonly Money[], currency: string): Money {
  return items.reduce((total, item) => add(total, item), zero(currency));
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minor === b.minor) return 0;
  return a.minor < b.minor ? -1 : 1;
}

export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.minor === b.minor;
export const isZero = (a: Money): boolean => a.minor === 0n;
export const isPositive = (a: Money): boolean => a.minor > 0n;
export const isNegative = (a: Money): boolean => a.minor < 0n;
export const min = (a: Money, b: Money): Money => (compare(a, b) <= 0 ? a : b);
export const max = (a: Money, b: Money): Money => (compare(a, b) >= 0 ? a : b);

/** Multiplies by a whole quantity (line quantity, number of units). */
export function multiply(a: Money, quantity: bigint | number): Money {
  return money(a.minor * toBigInt(quantity, 'Quantity'), a.currency);
}

/** Integer division of `numerator / denominator` with an explicit rounding mode. */
export function divideRound(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator === 0n) throw new MoneyError('DIVISION_BY_ZERO', 'Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  const remainder = n % d;
  if (remainder !== 0n) {
    const twice = remainder * 2n;
    switch (mode) {
      case 'down':
        break;
      case 'up':
        quotient += 1n;
        break;
      case 'half-up':
        if (twice >= d) quotient += 1n;
        break;
      case 'half-even':
        if (twice > d || (twice === d && quotient % 2n === 1n)) quotient += 1n;
        break;
    }
  }
  return negative ? -quotient : quotient;
}

/** Scales by `numerator / denominator`, for example currency conversion or proportional shares. */
export function ratio(
  a: Money,
  numerator: bigint | number,
  denominator: bigint | number,
  mode: RoundingMode = 'half-even',
): Money {
  const n = toBigInt(numerator, 'Numerator');
  const d = toBigInt(denominator, 'Denominator');
  return money(divideRound(a.minor * n, d, mode), a.currency);
}

/** A percentage given in basis points (1500 = 15%). Banker's rounding by default. */
export function percent(a: Money, basisPoints: bigint | number, mode: RoundingMode = 'half-even') {
  const bps = toBigInt(basisPoints, 'Rate');
  if (bps < 0n) throw new MoneyError('INVALID_AMOUNT', 'A rate must not be negative');
  return ratio(a, bps, BPS_DENOMINATOR, mode);
}

/** Tax portion contained in a tax-inclusive price. gross = net + tax. */
export function inclusiveTax(
  gross: Money,
  rateBps: bigint | number,
  mode: RoundingMode = 'half-even',
): Money {
  const rate = toBigInt(rateBps, 'Rate');
  if (rate < 0n || rate > BPS_DENOMINATOR) {
    throw new MoneyError('INVALID_AMOUNT', 'A tax rate must be between 0 and 10000 basis points');
  }
  return ratio(gross, rate, BPS_DENOMINATOR + rate, mode);
}

/** Tax to add on top of a tax-exclusive price. */
export const exclusiveTax = percent;

/**
 * Splits an amount across weights using the largest remainder method. The parts always sum to the
 * total exactly. Ties go to the earlier index. Use it to spread a discount across order lines.
 */
export function allocate(total: Money, weights: ReadonlyArray<bigint | number>): Money[] {
  if (weights.length === 0) {
    throw new MoneyError('INVALID_ALLOCATION', 'Cannot allocate across zero weights');
  }
  const w = weights.map((weight) => toBigInt(weight, 'Weight'));
  if (w.some((weight) => weight < 0n)) {
    throw new MoneyError('INVALID_ALLOCATION', 'Weights must not be negative');
  }
  const weightTotal = w.reduce((acc, weight) => acc + weight, 0n);
  if (weightTotal === 0n) {
    throw new MoneyError('INVALID_ALLOCATION', 'At least one weight must be greater than zero');
  }

  const negative = total.minor < 0n;
  const amount = negative ? -total.minor : total.minor;
  const shares = w.map((weight) => (amount * weight) / weightTotal);
  const remainders = w.map((weight, index) => ({ index, rest: (amount * weight) % weightTotal }));
  let leftover = amount - shares.reduce((acc, share) => acc + share, 0n);

  remainders.sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  for (const { index } of remainders) {
    if (leftover === 0n) break;
    shares[index] = shares[index]! + 1n; // index always comes from `remainders`, so it is in range
    leftover -= 1n;
  }
  return shares.map((share) => money(negative ? -share : share, total.currency));
}

/** Splits into `parts` near-equal amounts that sum to the total. */
export function split(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError('INVALID_ALLOCATION', 'Parts must be a positive integer');
  }
  return allocate(
    total,
    Array.from({ length: parts }, () => 1n),
  );
}

/** Plain decimal text for the amount, for example 129900 BDT minor -> "1299.00". */
export function toDecimalString(a: Money): string {
  const places = exponent(a.currency);
  const negative = a.minor < 0n;
  const digits = (negative ? -a.minor : a.minor).toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = places === 0 ? '' : `.${digits.slice(digits.length - places)}`;
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/**
 * Parses text typed by a person ("1,299.50", "1299") into Money without going through floats.
 * More fraction digits than the currency allows is an error, never silently rounded.
 */
export function fromDecimalString(text: string, currency: string): Money {
  const places = exponent(currency);
  // Commas are only accepted as thousands separators (1,299.50), never as a decimal mark.
  const trimmed = text.trim();
  if (!/^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(trimmed)) {
    throw new MoneyError('INVALID_AMOUNT', `Not a valid amount: "${text}"`);
  }
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed.replace(/,/g, ''))!;
  const [, sign, whole = '0', fraction = ''] = match;
  if (fraction.length > places) {
    throw new MoneyError(
      'INVALID_AMOUNT',
      `${currency} allows ${places} decimal places, got "${text}"`,
    );
  }
  const minor = BigInt(`${whole}${fraction.padEnd(places, '0')}`);
  return money(sign ? -minor : minor, currency);
}

export interface FormatOptions {
  locale?: string;
  /** Show "৳1,299" instead of "৳1,299.00" when there is no fractional part. */
  trimZeroFraction?: boolean;
}

/** Display formatting via Intl. Never use the output for calculation. */
export function format(a: Money, options: FormatOptions = {}): string {
  const { locale = 'en-BD', trimZeroFraction = false } = options;
  const whole = a.minor % 10n ** BigInt(exponent(a.currency)) === 0n;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: a.currency,
    ...(trimZeroFraction && whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  });
  return formatter.format(toDecimalString(a) as `${number}`);
}

export const serialize = (a: Money): SerializedMoney => ({
  minor: a.minor.toString(),
  currency: a.currency,
});

export function deserialize(value: SerializedMoney): Money {
  return money(value.minor, value.currency);
}
