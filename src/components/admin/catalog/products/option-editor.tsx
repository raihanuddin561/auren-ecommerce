'use client';

import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MAX_VALUES_PER_OPTION, isColourOption, type DraftOption } from './variant-preview';

interface OptionEditorProps {
  option: DraftOption;
  position: number;
  onChange: (option: DraftOption) => void;
  onRemove: () => void;
}

let counter = 0;
const newKey = () => `new-${(counter += 1)}`;

/** One option of the matrix: its name and its values as removable chips (type a value, press Enter). */
export function OptionEditor({ option, position, onChange, onRemove }: OptionEditorProps) {
  const [draft, setDraft] = useState('');
  const [hex, setHex] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const colour = isColourOption(option.name);

  function add() {
    const label = draft.trim();
    if (!label) return;
    if (option.values.length >= MAX_VALUES_PER_OPTION) {
      return void setProblem(`An option can have up to ${MAX_VALUES_PER_OPTION} values.`);
    }
    if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex.trim())) {
      return void setProblem('Use a colour such as #RRGGBB, or leave it blank.');
    }
    setProblem(null);
    onChange({
      ...option,
      values: [
        ...option.values,
        { key: newKey(), label, swatchHex: colour ? hex.trim().toUpperCase() : '' },
      ],
    });
    setDraft('');
    setHex('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  }

  const name = option.name.trim() || `Option ${position + 1}`;

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border border-line p-4">
      <legend className="px-2 type-small font-medium text-fg">{name}</legend>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Option name" className="min-w-0 flex-1 basis-48">
          {(control) => (
            <Input
              {...control}
              value={option.name}
              maxLength={30}
              onChange={(event) => onChange({ ...option, name: event.target.value })}
            />
          )}
        </FormField>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove option
        </Button>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <FormField
          label={`Add a ${name.toLowerCase()} value`}
          hint="Type a value and press Enter."
          error={problem}
          className="min-w-0 flex-1 basis-48"
        >
          {(control) => (
            <Input
              {...control}
              value={draft}
              maxLength={40}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
          )}
        </FormField>
        {colour ? (
          <FormField label="Swatch colour" hint="Optional, like #RRGGBB" className="basis-40">
            {(control) => (
              <Input
                {...control}
                value={hex}
                maxLength={7}
                placeholder="#RRGGBB"
                onChange={(event) => setHex(event.target.value)}
                onKeyDown={onKeyDown}
              />
            )}
          </FormField>
        ) : null}
        <Button type="button" variant="secondary" size="sm" className="mt-7" onClick={add}>
          Add value
        </Button>
      </div>
      {option.values.length > 0 ? (
        <ul aria-label={`${name} values`} className="flex flex-wrap gap-2">
          {option.values.map((value) => (
            <li
              key={value.key}
              className="inline-flex items-center gap-2 border border-line-strong bg-sunken pl-3 type-small"
            >
              {value.swatchHex ? (
                <span
                  aria-hidden="true"
                  className="size-3 border border-line-strong"
                  style={{ backgroundColor: value.swatchHex }}
                />
              ) : null}
              {value.label}
              <button
                type="button"
                aria-label={`Remove ${value.label} from ${name}`}
                onClick={() =>
                  onChange({ ...option, values: option.values.filter((v) => v.key !== value.key) })
                }
                className="inline-flex size-9 items-center justify-center text-fg-muted hover:text-fg"
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-small text-fg-muted">No values yet.</p>
      )}
    </fieldset>
  );
}
