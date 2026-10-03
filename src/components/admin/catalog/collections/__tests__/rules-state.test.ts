import { describe, expect, it } from 'vitest';
import {
  RULE_FIELDS,
  RULE_OPERATORS_BY_FIELD,
  type CollectionRules,
} from '@/modules/catalog/collection-rules';
import { collectionRulesSchema } from '@/modules/catalog/schemas';
import {
  conditionError,
  defaultCondition,
  FIELD_OPTIONS,
  MAX_CONDITIONS,
  OPERATOR_LABELS,
  previewableRules,
  previewSummary,
  rulesReducer,
} from '../rules-state';

const empty: CollectionRules = { match: 'all', conditions: [] };
const CATEGORY_ID = '0b9d6e5a-3c1f-4a77-9d2e-5f0f6c1a7b10';

describe('rules reducer', () => {
  it('adds a blank tag rule and removes by index', () => {
    const one = rulesReducer(empty, { type: 'add' });
    expect(one.conditions).toEqual([{ field: 'tag', operator: 'equals', value: '' }]);
    const two = rulesReducer(one, { type: 'add' });
    expect(rulesReducer(two, { type: 'remove', index: 0 }).conditions).toHaveLength(1);
  });

  it('stops at the maximum number of rules', () => {
    let state: CollectionRules = empty;
    for (let i = 0; i < MAX_CONDITIONS + 3; i++) state = rulesReducer(state, { type: 'add' });
    expect(state.conditions).toHaveLength(MAX_CONDITIONS);
  });

  it('switches match between all and any', () => {
    expect(rulesReducer(empty, { type: 'match', match: 'any' }).match).toBe('any');
  });

  it('changing the field resets the operator and value to ones that fit', () => {
    const start: CollectionRules = {
      match: 'all',
      conditions: [{ field: 'tag', operator: 'not_equals', value: 'summer' }],
    };
    const next = rulesReducer(start, { type: 'field', index: 0, field: 'price' });
    expect(next.conditions[0]).toEqual({ field: 'price', operator: 'less_than', value: '' });
  });

  it('only accepts operators allowed for the field', () => {
    const start: CollectionRules = { match: 'all', conditions: [defaultCondition('price')] };
    expect(
      rulesReducer(start, { type: 'operator', index: 0, operator: 'equals' }).conditions[0]
        ?.operator,
    ).toBe('less_than');
    expect(
      rulesReducer(start, { type: 'operator', index: 0, operator: 'greater_than' }).conditions[0]
        ?.operator,
    ).toBe('greater_than');
  });

  it('edits one value without touching the others', () => {
    const start = rulesReducer(rulesReducer(empty, { type: 'add' }), { type: 'add' });
    const next = rulesReducer(start, { type: 'value', index: 1, value: 'linen' });
    expect(next.conditions.map((c) => c.value)).toEqual(['', 'linen']);
  });

  it('keeps an operator label for every operator the server allows', () => {
    for (const field of RULE_FIELDS) {
      for (const operator of RULE_OPERATORS_BY_FIELD[field]) {
        expect(OPERATOR_LABELS[operator]).toBeTruthy();
      }
    }
    expect(FIELD_OPTIONS.map((o) => o.value)).toEqual([...RULE_FIELDS]);
  });
});

describe('rule checks', () => {
  it('accepts values the server accepts and rejects the ones it rejects', () => {
    const cases: Array<[Parameters<typeof conditionError>[0], boolean]> = [
      [{ field: 'tag', operator: 'equals', value: 'summer' }, true],
      [{ field: 'tag', operator: 'equals', value: '  ' }, false],
      [{ field: 'price', operator: 'less_than', value: '5000' }, true],
      [{ field: 'price', operator: 'greater_than', value: '2490.50' }, true],
      [{ field: 'price', operator: 'less_than', value: '2,490' }, false],
      [{ field: 'price', operator: 'less_than', value: '12.345' }, false],
      [{ field: 'price', operator: 'equals', value: '5000' }, false],
      [{ field: 'category', operator: 'equals', value: CATEGORY_ID }, true],
      [{ field: 'category', operator: 'equals', value: 'shirts' }, false],
      [{ field: 'fit', operator: 'equals', value: 'slim' }, true],
      [{ field: 'fit', operator: 'equals', value: 'tight' }, false],
    ];
    for (const [condition, valid] of cases) {
      expect(conditionError(condition) === null, JSON.stringify(condition)).toBe(valid);
      const parsed = collectionRulesSchema.safeParse({ match: 'all', conditions: [condition] });
      expect(parsed.success, `server: ${JSON.stringify(condition)}`).toBe(valid);
    }
  });

  it('previews only complete rules, with values trimmed', () => {
    expect(previewableRules(empty)).toBeNull();
    expect(previewableRules({ match: 'all', conditions: [defaultCondition()] })).toBeNull();
    const ready = previewableRules({
      match: 'any',
      conditions: [{ field: 'tag', operator: 'equals', value: '  linen ' }],
    });
    expect(ready?.conditions[0]?.value).toBe('linen');
  });

  it('words the preview count', () => {
    expect(previewSummary(1)).toBe('1 product matches');
    expect(previewSummary(0)).toBe('0 products match');
    expect(previewSummary(12)).toBe('12 products match');
  });
});
