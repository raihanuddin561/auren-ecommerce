import {
  RULE_OPERATORS_BY_FIELD,
  type CollectionRules,
  type RuleCondition,
  type RuleField,
} from '@/modules/catalog/collection-rules';

/** Pure state logic of the rules editor, kept apart from the markup so it can be tested alone. */

export const MAX_CONDITIONS = 10;

export const FIELD_OPTIONS: ReadonlyArray<{ value: RuleField; label: string }> = [
  { value: 'tag', label: 'Tag' },
  { value: 'category', label: 'Category' },
  { value: 'fit', label: 'Fit' },
  { value: 'price', label: 'Price' },
  { value: 'product_type', label: 'Product type' },
];

export const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  less_than: 'is below',
  greater_than: 'is above',
};

export const FIT_OPTIONS = ['slim', 'regular', 'relaxed'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE = /^\d+(\.\d{1,2})?$/;

export type RuleAction =
  | { type: 'match'; match: CollectionRules['match'] }
  | { type: 'add' }
  | { type: 'remove'; index: number }
  | { type: 'field'; index: number; field: RuleField }
  | { type: 'operator'; index: number; operator: string }
  | { type: 'value'; index: number; value: string }
  | { type: 'reset'; rules: CollectionRules };

export const operatorsFor = (field: RuleField): readonly string[] => RULE_OPERATORS_BY_FIELD[field];

export function defaultCondition(field: RuleField = 'tag'): RuleCondition {
  return { field, operator: operatorsFor(field)[0] ?? 'equals', value: '' };
}

function replaceAt(
  conditions: RuleCondition[],
  index: number,
  change: (condition: RuleCondition) => RuleCondition,
): RuleCondition[] {
  return conditions.map((condition, i) => (i === index ? change(condition) : condition));
}

export function rulesReducer(state: CollectionRules, action: RuleAction): CollectionRules {
  switch (action.type) {
    case 'match':
      return { ...state, match: action.match };
    case 'add':
      if (state.conditions.length >= MAX_CONDITIONS) return state;
      return { ...state, conditions: [...state.conditions, defaultCondition()] };
    case 'remove':
      return { ...state, conditions: state.conditions.filter((_, i) => i !== action.index) };
    case 'field':
      // A new field brings its own operators and a different kind of value: start clean.
      return {
        ...state,
        conditions: replaceAt(state.conditions, action.index, () => defaultCondition(action.field)),
      };
    case 'operator':
      return {
        ...state,
        conditions: replaceAt(state.conditions, action.index, (c) =>
          operatorsFor(c.field).includes(action.operator) ? { ...c, operator: action.operator } : c,
        ),
      };
    case 'value':
      return {
        ...state,
        conditions: replaceAt(state.conditions, action.index, (c) => ({
          ...c,
          value: action.value,
        })),
      };
    case 'reset':
      return action.rules;
  }
}

/** The same checks the server makes, so a mistake is shown before the round trip. */
export function conditionError(condition: RuleCondition): string | null {
  const value = condition.value.trim();
  if (!operatorsFor(condition.field).includes(condition.operator)) {
    return 'That comparison does not fit this field';
  }
  if (value === '') return 'Enter a value';
  if (value.length > 80) return 'Use 80 characters or fewer';
  if (condition.field === 'price' && !PRICE.test(value)) return 'Enter a price such as 5000';
  if (condition.field === 'category' && !UUID.test(value)) return 'Choose a category';
  if (condition.field === 'fit' && !(FIT_OPTIONS as readonly string[]).includes(value)) {
    return 'Choose slim, regular or relaxed';
  }
  return null;
}

/** Rules as the server expects them: values trimmed. */
export function cleanRules(rules: CollectionRules): CollectionRules {
  return {
    match: rules.match,
    conditions: rules.conditions.map((c) => ({ ...c, value: c.value.trim() })),
  };
}

/** The rules to preview, or null while there is nothing complete to ask about. */
export function previewableRules(rules: CollectionRules): CollectionRules | null {
  if (rules.conditions.length === 0) return null;
  if (rules.conditions.some((c) => conditionError(c) !== null)) return null;
  return cleanRules(rules);
}

export const EMPTY_MANUAL_RULES: CollectionRules = { match: 'all', conditions: [] };

/** One calm sentence for the preview line. */
export function previewSummary(count: number): string {
  return count === 1 ? '1 product matches' : `${count} products match`;
}
