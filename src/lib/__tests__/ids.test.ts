import { beforeEach, describe, expect, it } from 'vitest';
import { isUuid, newId, resetIdState } from '../ids';

describe('newId', () => {
  beforeEach(() => resetIdState());

  it('produces RFC 9562 version 7 UUIDs with the variant bits set', () => {
    const id = newId();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const at = Date.now() + 10 ** 10;
    const id = newId(at);
    const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(ms).toBe(at);
  });

  it('is strictly increasing even within one millisecond', () => {
    const ids = Array.from({ length: 5000 }, () => newId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ordering when the clock stalls or moves backwards', () => {
    const t = 1_900_000_000_000;
    const first = newId(t);
    const stalled = newId(t);
    const backwards = newId(t - 5_000);
    expect([first, stalled, backwards]).toEqual([first, stalled, backwards].toSorted());
    expect(backwards > stalled).toBe(true);
  });

  it('advances the timestamp when more than 4096 ids share a millisecond', () => {
    const t = 1_900_000_000_000;
    const ids = Array.from({ length: 4100 }, () => newId(t));
    expect(ids).toEqual(ids.toSorted());
    expect(new Set(ids).size).toBe(4100);
    const lastMs = parseInt(ids[4099]!.replace(/-/g, '').slice(0, 12), 16);
    expect(lastMs).toBe(t + 1);
  });
});
