'use client';

import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { addTags, MAX_TAGS } from './details-state';

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string | null;
}

/** Tags typed one at a time: Enter or a comma adds, each chip has its own remove button. */
export function TagsInput({ tags, onChange, error }: TagsInputProps) {
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function commit(raw: string) {
    if (!raw.trim()) return;
    const result = addTags(tags, raw);
    setProblem(result.error);
    if (result.tags.length !== tags.length) onChange(result.tags);
    // Keep the text only when nothing was accepted, so the person can fix it.
    setDraft(result.error && result.tags.length === tags.length ? raw : '');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <FormField
        label="Tags"
        hint={`Press Enter or a comma to add. Lowercase, up to ${MAX_TAGS} (${tags.length} used).`}
        error={problem ?? error}
      >
        {(control) => (
          <Input
            {...control}
            value={draft}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit(draft)}
          />
        )}
      </FormField>
      {tags.length > 0 ? (
        <ul aria-label="Current tags" className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 border border-line-strong bg-sunken pl-3 type-small"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="inline-flex size-9 items-center justify-center text-fg-muted hover:text-fg"
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
