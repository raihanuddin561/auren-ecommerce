import { describe, expect, it } from 'vitest';
import { COLLECTION_SORTS, createCollectionSchema } from '@/modules/catalog/schemas';
import {
  buildPayload,
  emptyValues,
  isoToLocalInput,
  localInputToIso,
  resolvePublishedAt,
  slugPreview,
  SORT_OPTIONS,
} from '../form-state';

const now = new Date('2026-10-03T10:00:00.000Z');

describe('publish dates', () => {
  it('turns a datetime-local value into an ISO string with an offset', () => {
    const iso = localInputToIso('2026-12-01T09:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('not a date')).toBeNull();
  });

  it('round-trips through the local input without losing the minute', () => {
    const local = '2026-12-01T09:30';
    const iso = localInputToIso(local);
    expect(iso && isoToLocalInput(iso)).toBe(local);
    expect(isoToLocalInput('nonsense')).toBe('');
  });

  it('resolves each mode', () => {
    const context = { savedPublishedAt: '2026-09-01T00:00:00.000Z', now };
    expect(resolvePublishedAt({ publishMode: 'draft', scheduledAt: '' }, context)).toEqual({
      ok: true,
      publishedAt: null,
    });
    expect(resolvePublishedAt({ publishMode: 'keep', scheduledAt: '' }, context)).toEqual({
      ok: true,
      publishedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(resolvePublishedAt({ publishMode: 'now', scheduledAt: '' }, context)).toEqual({
      ok: true,
      publishedAt: now.toISOString(),
    });
  });

  it('asks for a future date when scheduling', () => {
    const context = { savedPublishedAt: null, now: new Date('2026-10-03T10:00:00') };
    expect(resolvePublishedAt({ publishMode: 'schedule', scheduledAt: '' }, context).ok).toBe(
      false,
    );
    expect(
      resolvePublishedAt({ publishMode: 'schedule', scheduledAt: '2026-10-01T09:00' }, context).ok,
    ).toBe(false);
    const future = resolvePublishedAt(
      { publishMode: 'schedule', scheduledAt: '2026-11-01T09:00' },
      context,
    );
    expect(future.ok).toBe(true);
  });
});

describe('slug preview', () => {
  it('uses the typed slug, else the title', () => {
    expect(slugPreview('Summer Linen Edit', '')).toBe('summer-linen-edit');
    expect(slugPreview('Summer Linen Edit', 'Linen Shop')).toBe('linen-shop');
    expect(slugPreview('', '')).toBe('');
  });
});

describe('payload', () => {
  it('is accepted by the server schema for a manual collection', () => {
    const values = { ...emptyValues(), title: '  Summer edit  ' };
    const payload = buildPayload(values, null);
    expect(payload.title).toBe('Summer edit');
    expect(payload.rules).toEqual({ match: 'all', conditions: [] });
    expect(createCollectionSchema.safeParse(payload).success).toBe(true);
  });

  it('drops rules from a manual collection and keeps them for an automatic one', () => {
    const rules = {
      match: 'any' as const,
      conditions: [{ field: 'tag' as const, operator: 'equals', value: ' linen ' }],
    };
    const manual = buildPayload({ ...emptyValues(), title: 'A', rules }, null);
    expect(manual.rules.conditions).toEqual([]);
    const automatic = buildPayload(
      { ...emptyValues(), title: 'A', type: 'automatic', rules },
      null,
    );
    expect(automatic.rules.conditions[0]?.value).toBe('linen');
    expect(createCollectionSchema.safeParse(automatic).success).toBe(true);
  });

  it('offers exactly the sort orders the server knows', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([...COLLECTION_SORTS]);
  });
});
