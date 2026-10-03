'use client';

import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ActionDispatch } from 'react';
import { failureMessage, firstError, type FieldErrorMap } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { previewCollectionRules, refreshCollection } from '@/modules/catalog/actions';
import type { CollectionRules, RuleField } from '@/modules/catalog/collection-rules';
import {
  FIELD_OPTIONS,
  FIT_OPTIONS,
  MAX_CONDITIONS,
  OPERATOR_LABELS,
  operatorsFor,
  previewableRules,
  previewSummary,
  type RuleAction,
} from './rules-state';

export interface CategoryOption {
  id: string;
  label: string;
}

interface RulesEditorProps {
  rules: CollectionRules;
  dispatch: ActionDispatch<[RuleAction]>;
  categories: CategoryOption[];
  /** Field errors of the form, keyed like "rules" and "rules.conditions.0.value". */
  errors: FieldErrorMap;
  /** Saved collection to refresh members for; null while creating. */
  collectionId: string | null;
  /** The rules on screen differ from the saved ones, so a refresh would use older rules. */
  rulesChanged: boolean;
  disabled: boolean;
}

type PreviewResult =
  | { key: string; state: 'ready'; count: number; sample: string[] }
  | { key: string; state: 'error'; message: string };

const FIELD_HINT: Record<RuleField, string> = {
  tag: 'For example summer',
  category: '',
  fit: '',
  price: 'In taka, for example 5000',
  product_type: 'For example Oxford shirt',
};

/**
 * Rules of an automatic collection: match all or any, up to ten conditions, each with a value input
 * that suits its field, and a live preview of how many products match.
 */
export function RulesEditor({
  rules,
  dispatch,
  categories,
  errors,
  collectionId,
  rulesChanged,
  disabled,
}: RulesEditorProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const previewable = useMemo(() => previewableRules(rules), [rules]);
  const key = previewable ? JSON.stringify(previewable) : null;

  // Debounced preview. The result carries the rules it answers, so an old answer is never shown
  // for newer rules and no state is set while nothing has changed.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let response: Awaited<ReturnType<typeof previewCollectionRules>>;
      try {
        response = await previewCollectionRules({ rules: JSON.parse(key) as CollectionRules });
      } catch {
        if (!cancelled)
          setResult({ key, state: 'error', message: 'The preview could not be loaded.' });
        return;
      }
      if (cancelled) return;
      setResult(
        response.ok
          ? { key, state: 'ready', count: response.data.count, sample: response.data.sample }
          : { key, state: 'error', message: failureMessage(response) ?? 'The preview failed.' },
      );
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  async function refresh() {
    if (!collectionId) return;
    setRefreshing(true);
    const response = await refreshCollection({ id: collectionId });
    setRefreshing(false);
    if (!response.ok) {
      toast.error(failureMessage(response) ?? 'The members could not be refreshed.');
      return;
    }
    toast.success('Members refreshed', previewSummary(response.data.count));
    router.refresh();
  }

  const atLimit = rules.conditions.length >= MAX_CONDITIONS;
  const fresh = result && key && result.key === key ? result : null;

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1" disabled={disabled}>
        <legend className="type-small font-medium text-fg">Products must match</legend>
        <RadioGroup
          value={rules.match}
          onValueChange={(value) =>
            dispatch({ type: 'match', match: value === 'any' ? 'any' : 'all' })
          }
          className="sm:grid-cols-2"
          aria-label="How rules combine"
        >
          <RadioItem value="all" label="All of the rules" disabled={disabled} />
          <RadioItem value="any" label="Any of the rules" disabled={disabled} />
        </RadioGroup>
      </fieldset>

      {rules.conditions.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-6 type-admin text-fg-muted">
          No rules yet. Add a rule to choose which products belong here.
        </p>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Rules">
          {rules.conditions.map((condition, index) => {
            const base = `rules.conditions.${index}`;
            const number = index + 1;
            return (
              <li
                key={index}
                className="grid gap-3 border border-line p-3 sm:grid-cols-[10rem_9rem_minmax(0,1fr)_auto] sm:items-start"
              >
                <FormField
                  label={`Rule ${number} field`}
                  hideLabel
                  error={firstError(errors, `${base}.field`)}
                >
                  {(control) => (
                    <Select
                      value={condition.field}
                      disabled={disabled}
                      onValueChange={(value) =>
                        dispatch({ type: 'field', index, field: value as RuleField })
                      }
                    >
                      <SelectTrigger {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>

                <FormField
                  label={`Rule ${number} comparison`}
                  hideLabel
                  error={firstError(errors, `${base}.operator`)}
                >
                  {(control) => (
                    <Select
                      value={condition.operator}
                      disabled={disabled}
                      onValueChange={(value) =>
                        dispatch({ type: 'operator', index, operator: value })
                      }
                    >
                      <SelectTrigger {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorsFor(condition.field).map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {OPERATOR_LABELS[operator] ?? operator}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>

                <FormField
                  label={`Rule ${number} value`}
                  hideLabel
                  hint={FIELD_HINT[condition.field] || undefined}
                  error={firstError(errors, `${base}.value`)}
                >
                  {(control) =>
                    condition.field === 'category' || condition.field === 'fit' ? (
                      <Select
                        value={condition.value}
                        disabled={disabled}
                        onValueChange={(value) => dispatch({ type: 'value', index, value })}
                      >
                        <SelectTrigger {...control}>
                          <SelectValue
                            placeholder={
                              condition.field === 'category' ? 'Choose a category' : 'Choose a fit'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {condition.field === 'category'
                            ? categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.label}
                                </SelectItem>
                              ))
                            : FIT_OPTIONS.map((fit) => (
                                <SelectItem key={fit} value={fit} className="capitalize">
                                  {fit}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        {...control}
                        value={condition.value}
                        maxLength={80}
                        inputMode={condition.field === 'price' ? 'decimal' : undefined}
                        autoComplete="off"
                        onChange={(event) =>
                          dispatch({ type: 'value', index, value: event.target.value })
                        }
                      />
                    )
                  }
                </FormField>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove rule ${number}`}
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'remove', index })}
                >
                  <Icon icon={Trash2} size={18} />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      {firstError(errors, 'rules') ? (
        <p role="alert" className="type-small text-danger-text">
          {firstError(errors, 'rules')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || atLimit}
          onClick={() => dispatch({ type: 'add' })}
        >
          <Icon icon={Plus} size={16} />
          Add rule
        </Button>
        {atLimit ? (
          <p className="type-small text-fg-muted">
            A collection can have up to {MAX_CONDITIONS} rules.
          </p>
        ) : null}
      </div>

      <section
        aria-label="Preview"
        className="flex flex-col gap-3 border border-line bg-sunken p-4"
      >
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          <p className="type-eyebrow text-fg-muted">Preview</p>
          {!key ? (
            <p className="type-admin text-fg-muted">
              {rules.conditions.length === 0
                ? 'Add a rule to see how many products match.'
                : 'Complete every rule to see how many products match.'}
            </p>
          ) : !fresh ? (
            <>
              <Skeleton className="h-5 w-40" />
              <span className="sr-only">Checking which products match</span>
            </>
          ) : fresh.state === 'error' ? (
            <p className="type-admin text-danger-text">{fresh.message}</p>
          ) : (
            <>
              <p className="type-admin font-medium text-fg">{previewSummary(fresh.count)}</p>
              {fresh.sample.length > 0 ? (
                <p className="type-small text-fg-muted">
                  {fresh.sample.join(', ')}
                  {fresh.count > fresh.sample.length ? ' and more' : ''}
                </p>
              ) : null}
            </>
          )}
        </div>

        {collectionId ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="type-small text-fg-muted">
              {rulesChanged
                ? 'Save the rules first. Refreshing members uses the saved rules.'
                : 'Members are recalculated from the saved rules.'}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={refreshing}
              disabled={disabled || rulesChanged}
              onClick={refresh}
            >
              <Icon icon={RefreshCw} size={16} />
              Refresh members
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
