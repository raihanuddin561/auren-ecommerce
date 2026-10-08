import { normalizeBdPhone } from '@/lib/phone';

/** What the customer has typed so far. Persisted in the tab (sessionStorage) so a refresh keeps it. */
export interface CheckoutDraft {
  phone: string;
  name: string;
  email: string;
  divisionId: string;
  divisionName?: string;
  districtId: string;
  districtName?: string;
  manualAddress?: boolean;
  thanaId: string;
  /** Typed when the customer's thana or upazila is not in the list or in manual mode. */
  thanaName: string;
  area: string;
  line1: string;
  line2: string;
  postalCode: string;
  note: string;
  shippingRateId: string;
  /** Generated when the form first opens; the same value is sent on every retry (idempotency). */
  idempotencyKey: string;
}

export const EMPTY_DRAFT: Omit<CheckoutDraft, 'idempotencyKey'> = {
  phone: '',
  name: '',
  email: '',
  divisionId: '',
  divisionName: '',
  districtId: '',
  districtName: '',
  manualAddress: false,
  thanaId: '',
  thanaName: '',
  area: '',
  line1: '',
  line2: '',
  postalCode: '',
  note: '',
  shippingRateId: '',
};

export type FieldKey =
  | 'phone'
  | 'name'
  | 'email'
  | 'divisionId'
  | 'districtId'
  | 'thana'
  | 'area'
  | 'line1'
  | 'postalCode'
  | 'otp'
  | 'shippingRateId'
  | 'paymentMethod';

export type FieldErrors = Partial<Record<FieldKey, string>>;

/** Order the fields appear in, so the first mistake can be focused. */
export const FIELD_ORDER: readonly FieldKey[] = [
  'phone',
  'name',
  'email',
  'divisionId',
  'districtId',
  'thana',
  'area',
  'line1',
  'postalCode',
  'shippingRateId',
  'paymentMethod',
  'otp',
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(
  key: FieldKey,
  draft: CheckoutDraft,
  options: { thanasListed: boolean; notListed: boolean },
): string | null {
  switch (key) {
    case 'phone':
      if (!draft.phone.trim()) return 'Enter the phone number we can call to confirm your order.';
      return normalizeBdPhone(draft.phone)
        ? null
        : 'Enter a Bangladesh mobile number, for example 01712 345678.';
    case 'name':
      return draft.name.trim().length >= 2 ? null : 'Enter your full name.';
    case 'email':
      return !draft.email.trim() || EMAIL.test(draft.email.trim())
        ? null
        : 'This email address does not look right.';
    case 'divisionId':
      return draft.divisionId?.trim() || draft.divisionName?.trim()
        ? null
        : 'Please enter or choose your division.';
    case 'districtId':
      return draft.districtId?.trim() || draft.districtName?.trim()
        ? null
        : 'Please enter or choose your district.';
    case 'thana':
      if (options.thanasListed && !options.notListed) {
        return draft.thanaId ? null : 'Choose your thana or upazila.';
      }
      return draft.thanaName.trim().length >= 2 ? null : 'Tell us your thana or upazila.';
    case 'area':
      return draft.area.trim().length >= 2 ? null : 'Enter your area or neighbourhood.';
    case 'line1':
      return draft.line1.trim().length >= 5
        ? null
        : 'Enter your house, road and any landmark, so the courier can find you.';
    case 'postalCode':
      return !draft.postalCode.trim() || /^\d{4}$/.test(draft.postalCode.trim())
        ? null
        : 'A postal code has 4 digits.';
    default:
      return null;
  }
}

/** Every mistake in the draft, keyed by field. Empty means the form can be sent. */
export function validateDraft(
  draft: CheckoutDraft,
  options: { thanasListed: boolean; notListed: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of FIELD_ORDER) {
    const message = validateField(key, draft, options);
    if (message) errors[key] = message;
  }
  return errors;
}

export function firstInvalid(errors: FieldErrors): FieldKey | null {
  return FIELD_ORDER.find((key) => errors[key]) ?? null;
}

/** Maps the server's field names (contact.phone, address.thanaName ...) onto the form's fields. */
export function mapServerErrors(fieldErrors: Record<string, string[]> | undefined): FieldErrors {
  const map: Record<string, FieldKey> = {
    'contact.phone': 'phone',
    'contact.name': 'name',
    'contact.email': 'email',
    'address.divisionId': 'divisionId',
    'address.divisionName': 'divisionId',
    'address.districtId': 'districtId',
    'address.districtName': 'districtId',
    districtId: 'districtId',
    'address.thanaName': 'thana',
    'address.thanaId': 'thana',
    'address.area': 'area',
    'address.line1': 'line1',
    'address.postalCode': 'postalCode',
    otp: 'otp',
    paymentMethod: 'paymentMethod',
    shippingRateId: 'shippingRateId',
  };
  const errors: FieldErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const key = map[field];
    if (key && messages[0] && !errors[key]) errors[key] = messages[0];
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// Draft storage
// ---------------------------------------------------------------------------------------------

export const DRAFT_STORAGE_KEY = 'auren:checkout-draft:v1';

export const newIdempotencyKey = (): string => `co-${globalThis.crypto.randomUUID()}`;

export function parseDraft(raw: string | null): CheckoutDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const draft = { ...EMPTY_DRAFT, idempotencyKey: '' } as CheckoutDraft;
    for (const key of Object.keys(draft) as Array<keyof CheckoutDraft>) {
      const stored = record[key];
      if (key === 'manualAddress') {
        draft.manualAddress = Boolean(stored);
      } else if (typeof stored === 'string') {
        (draft as unknown as Record<string, string>)[key] = stored.slice(0, 400);
      }
    }
    return draft.idempotencyKey ? draft : null;
  } catch {
    return null;
  }
}
