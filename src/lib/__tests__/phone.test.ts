import { describe, expect, it } from 'vitest';
import { formatBdPhone, maskEmail, maskPhone, normalizeBdPhone } from '../phone';

describe('normalizeBdPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['01712 345678', '+8801712345678'],
    ['017-1234-5678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['+880 1712-345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['008801712345678', '+8801712345678'],
    ['(0171) 2345678', '+8801712345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each([
    '',
    '1712345678',
    '0171234567',
    '017123456789',
    '01212345678',
    '02712345678',
    '+8801212345678',
    '+8811712345678',
    'abcdefghijk',
    '01712 34567x',
  ])('rejects %s', (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
  });

  it('every operator prefix from 013 to 019 works', () => {
    for (const prefix of ['013', '014', '015', '016', '017', '018', '019']) {
      expect(normalizeBdPhone(`${prefix}12345678`)).toBe(`+880${prefix.slice(1)}12345678`);
    }
  });
});

describe('display helpers', () => {
  it('formats and masks without exposing the whole number', () => {
    expect(formatBdPhone('+8801712345678')).toBe('01712 345678');
    expect(maskPhone('+8801712345678')).toBe('+88017***678');
    expect(maskPhone('+88')).toBe('***');
    expect(maskEmail('ayaan@example.com')).toBe('a***@example.com');
  });
});
