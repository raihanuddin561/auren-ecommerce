import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PROOF_TTL_SECONDS,
  deriveTrackingToken,
  factorMatches,
  hashTrackingToken,
  isTrackingToken,
  normalizeFactor,
  safeEqual,
  signOrderProof,
  verifyOrderProof,
} from '../tracking';

const ORDER = '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e6f';
const OTHER = '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e70';

describe('tracking token (INV-O10)', () => {
  it('is 128 bits (22 base64url characters), stable per order and different between orders', () => {
    const token = deriveTrackingToken(ORDER);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(16);
    expect(deriveTrackingToken(ORDER)).toBe(token);
    expect(deriveTrackingToken(OTHER)).not.toBe(token);
  });

  it('is not derivable from the order id alone: it does not contain or hash to the id', () => {
    const token = deriveTrackingToken(ORDER);
    expect(token).not.toContain(ORDER.slice(0, 8));
    expect(token).not.toBe(createHash('sha256').update(ORDER).digest('base64url').slice(0, 22));
  });

  it('stores a SHA-256 hash, never the token', () => {
    const token = deriveTrackingToken(ORDER);
    const hash = hashTrackingToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token);
  });

  it('recognises only well formed tokens', () => {
    expect(isTrackingToken(deriveTrackingToken(ORDER))).toBe(true);
    for (const bad of [undefined, null, '', 'short', 'a'.repeat(23), `${'a'.repeat(21)}!`, 12]) {
      expect(isTrackingToken(bad)).toBe(false);
    }
  });

  it('compares in constant time and by value', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('second factor', () => {
  it('normalises phone numbers and emails and rejects everything else', () => {
    expect(normalizeFactor('01712 345678')).toEqual({ kind: 'phone', value: '+8801712345678' });
    expect(normalizeFactor('  Ayaan@Example.COM ')).toEqual({
      kind: 'email',
      value: 'ayaan@example.com',
    });
    for (const bad of [
      '',
      'AUR-100001',
      '12345',
      'not an email@',
      '@example.com',
      'a@b',
      'x'.repeat(260) + '@a.bc',
    ]) {
      expect(normalizeFactor(bad)).toBeNull();
    }
  });

  it('matches the phone or the email on the order, never the wrong one', () => {
    const order = { phone: '+8801712345678', email: 'Ayaan@Example.com' };
    expect(factorMatches({ kind: 'phone', value: '+8801712345678' }, order)).toBe(true);
    expect(factorMatches({ kind: 'phone', value: '+8801712345679' }, order)).toBe(false);
    expect(factorMatches({ kind: 'email', value: 'ayaan@example.com' }, order)).toBe(true);
    expect(factorMatches({ kind: 'email', value: 'other@example.com' }, order)).toBe(false);
    // An order without an email can never be unlocked by an email.
    expect(
      factorMatches(
        { kind: 'email', value: 'ayaan@example.com' },
        { phone: order.phone, email: null },
      ),
    ).toBe(false);
  });
});

describe('order proof cookie', () => {
  const now = new Date('2026-10-05T10:00:00Z');

  it('proves one order for a day and nothing else', () => {
    const proof = signOrderProof(ORDER, now);
    expect(verifyOrderProof(proof, ORDER, now)).toBe(true);
    expect(verifyOrderProof(proof, OTHER, now)).toBe(false);
    const nearEnd = new Date(now.getTime() + (PROOF_TTL_SECONDS - 1) * 1000);
    expect(verifyOrderProof(proof, ORDER, nearEnd)).toBe(true);
    const expired = new Date(now.getTime() + (PROOF_TTL_SECONDS + 1) * 1000);
    expect(verifyOrderProof(proof, ORDER, expired)).toBe(false);
  });

  it('rejects tampering: another order id, a longer expiry, a bad signature, junk', () => {
    const [id, expires, signature] = signOrderProof(ORDER, now).split('.');
    expect(verifyOrderProof(`${OTHER}.${expires}.${signature}`, OTHER, now)).toBe(false);
    expect(verifyOrderProof(`${id}.${Number(expires) + 99999}.${signature}`, ORDER, now)).toBe(
      false,
    );
    expect(verifyOrderProof(`${id}.${expires}.${'0'.repeat(64)}`, ORDER, now)).toBe(false);
    for (const junk of [
      undefined,
      '',
      'a.b',
      'a.b.c.d',
      `${id}..${signature}`,
      `${id}.x.${signature}`,
    ]) {
      expect(verifyOrderProof(junk, ORDER, now)).toBe(false);
    }
  });
});
