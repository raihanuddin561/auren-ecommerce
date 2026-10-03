/**
 * Rules for automatic collections. A rule set is { match: 'all' | 'any', conditions: [...] }; the
 * repository turns it into a database filter. Pure and typed here so forms, the preview and the
 * tests share one definition. Values are validated in schemas.ts.
 */

export const RULE_FIELDS = ['tag', 'category', 'fit', 'price', 'product_type'] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPERATORS_BY_FIELD: Record<RuleField, readonly string[]> = {
  tag: ['equals', 'not_equals'],
  category: ['equals', 'not_equals'],
  fit: ['equals', 'not_equals'],
  product_type: ['equals', 'not_equals'],
  /** Selling price in whole currency units, compared with the lowest active variant price. */
  price: ['less_than', 'greater_than'],
};

export interface RuleCondition {
  field: RuleField;
  operator: string;
  /** Text for tag/category id/fit/type; a decimal string for price (parsed with lib/money). */
  value: string;
}

export interface CollectionRules {
  match: 'all' | 'any';
  conditions: RuleCondition[];
}

export const EMPTY_RULES: CollectionRules = { match: 'all', conditions: [] };

export const describeCondition = (c: RuleCondition, categoryName?: string): string => {
  const subject = {
    tag: 'Tag',
    category: 'Category',
    fit: 'Fit',
    product_type: 'Type',
    price: 'Price',
  }[c.field];
  const op = {
    equals: 'is',
    not_equals: 'is not',
    less_than: 'is below',
    greater_than: 'is above',
  }[c.operator];
  return `${subject} ${op ?? c.operator} ${categoryName ?? c.value}`;
};
