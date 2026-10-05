import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFT,
  firstInvalid,
  mapServerErrors,
  parseDraft,
  validateDraft,
  validateField,
  type CheckoutDraft,
} from '../validation';

const draft = (overrides: Partial<CheckoutDraft> = {}): CheckoutDraft => ({
  ...EMPTY_DRAFT,
  idempotencyKey: 'co-12345678',
  phone: '01712 345678',
  name: 'Ayaan Rahman',
  divisionId: 'd',
  districtId: 'dd',
  thanaId: 't',
  area: 'Section 10',
  line1: 'House 12, Road 4',
  ...overrides,
});
const listed = { thanasListed: true, notListed: false };

describe('checkout field validation', () => {
  it('accepts a complete form', () => {
    expect(validateDraft(draft(), listed)).toEqual({});
  });

  it('asks for the phone first and explains what is wrong', () => {
    expect(validateField('phone', draft({ phone: '' }), listed)).toMatch(
      /phone number we can call/,
    );
    expect(validateField('phone', draft({ phone: '12345' }), listed)).toMatch(
      /Bangladesh mobile number/,
    );
    expect(validateField('phone', draft({ phone: '+880 1712-345678' }), listed)).toBeNull();
  });

  it('email is optional but must look like one when given', () => {
    expect(validateField('email', draft({ email: '' }), listed)).toBeNull();
    expect(validateField('email', draft({ email: 'ayaan@example.com' }), listed)).toBeNull();
    expect(validateField('email', draft({ email: 'ayaan@' }), listed)).toMatch(
      /does not look right/,
    );
  });

  it('needs a thana from the list, or a typed one when the area is not listed', () => {
    expect(validateField('thana', draft({ thanaId: '' }), listed)).toMatch(/Choose your thana/);
    expect(
      validateField('thana', draft({ thanaId: '', thanaName: 'Uttar Badda' }), {
        thanasListed: true,
        notListed: true,
      }),
    ).toBeNull();
    expect(
      validateField('thana', draft({ thanaId: '', thanaName: '' }), {
        thanasListed: true,
        notListed: true,
      }),
    ).toMatch(/Tell us/);
    // A district with no listed thanas always asks for text.
    expect(
      validateField('thana', draft({ thanaId: '', thanaName: 'Sadar' }), {
        thanasListed: false,
        notListed: false,
      }),
    ).toBeNull();
    expect(
      validateField('thana', draft({ thanaId: '', thanaName: '' }), {
        thanasListed: false,
        notListed: false,
      }),
    ).toMatch(/Tell us/);
  });

  it('checks address, postal code and finds the first mistake in page order', () => {
    const errors = validateDraft(
      draft({ name: '', line1: 'x', postalCode: '12', phone: '' }),
      listed,
    );
    expect(Object.keys(errors)).toEqual(['phone', 'name', 'line1', 'postalCode']);
    expect(firstInvalid(errors)).toBe('phone');
    expect(firstInvalid({})).toBeNull();
  });

  it('maps server field names onto form fields', () => {
    expect(
      mapServerErrors({
        'contact.phone': ['Bad phone'],
        'address.thanaName': ['Need thana'],
        otp: ['Wrong code'],
        unknown: ['ignored'],
      }),
    ).toEqual({ phone: 'Bad phone', thana: 'Need thana', otp: 'Wrong code' });
    expect(mapServerErrors(undefined)).toEqual({});
  });
});

describe('draft storage', () => {
  it('round-trips a saved draft and keeps the idempotency key', () => {
    const saved = draft({ note: 'After 5 pm' });
    expect(parseDraft(JSON.stringify(saved))).toEqual(saved);
  });

  it('ignores damaged, foreign or key-less storage', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('[]')).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft(), idempotencyKey: '' }))).toBeNull();
    const clean = parseDraft(JSON.stringify({ ...draft(), phone: 5, extra: 'x' }));
    expect(clean?.phone).toBe('');
    expect(clean && 'extra' in clean).toBe(false);
  });
});
