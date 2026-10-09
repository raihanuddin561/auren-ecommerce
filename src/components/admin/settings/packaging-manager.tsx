'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormSection } from '@/components/admin/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { savePackagingProfileAction } from '@/modules/shipping/actions';

export interface PackagingRow {
  id: string;
  name: string;
  /** Taka text, for example "35" or "35.50". */
  cost: string;
  isDefault: boolean;
  active: boolean;
}

/**
 * Packaging profiles (6.9): the box, tissue and card that go with an order. The default profile's
 * cost is added to every order when its parcel is booked.
 */
export function PackagingManager({ profiles }: { profiles: PackagingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<PackagingRow | null>(null);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function begin(row: PackagingRow | null) {
    setEditing(row);
    setName(row?.name ?? '');
    setCost(row?.cost ?? '');
    setIsDefault(row?.isDefault ?? profiles.length === 0);
    setActive(row?.active ?? true);
    setErrors({});
    setFormError(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await savePackagingProfileAction({
          ...(editing ? { id: editing.id } : {}),
          name: name.trim(),
          cost: cost.trim(),
          isDefault,
          active,
        });
        if (result.ok) {
          toast.success('Packaging saved');
          setName('');
          setCost('');
          setEditing(null);
          router.refresh();
        } else {
          setErrors(fieldErrorsOf(result));
          setFormError(failureMessage(result));
        }
      } catch {
        setFormError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <FormSection
      title="Packaging"
      description="What the box, tissue and card cost. The default profile's cost is added to each order when its parcel is booked, so the profit of an order includes it."
    >
      {profiles.length === 0 ? (
        <p className="type-admin text-fg-muted">
          No packaging profile yet. Orders are costed without packaging.
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {profiles.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="type-admin text-fg">
                {row.name} <span className="text-fg-muted">BDT {row.cost}</span>
                {row.isDefault ? (
                  <Badge tone="gold" className="ml-2">
                    Default
                  </Badge>
                ) : null}
                {!row.active ? (
                  <Badge tone="neutral" className="ml-2">
                    Inactive
                  </Badge>
                ) : null}
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => begin(row)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4 border border-line p-4" noValidate>
        <p className="type-eyebrow text-fg-muted">
          {editing ? `Edit ${editing.name}` : 'New profile'}
        </p>
        <FormField label="Name" required error={firstError(errors, 'name')} className="max-w-sm">
          {(control) => (
            <Input
              {...control}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Cost per order (BDT)"
          required
          error={firstError(errors, 'cost')}
          className="max-w-sm"
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={cost}
              maxLength={12}
              onChange={(e) => setCost(e.target.value)}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-6">
          <Switch
            checked={isDefault}
            onCheckedChange={setIsDefault}
            label="Default for every order"
          />
          <Switch checked={active} onCheckedChange={setActive} label="Active" />
        </div>
        <p role="alert" className="min-h-5 type-small text-danger-text">
          {formError}
        </p>
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={pending}>
            {editing ? 'Save profile' : 'Add profile'}
          </Button>
          {editing ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => begin(null)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </FormSection>
  );
}
