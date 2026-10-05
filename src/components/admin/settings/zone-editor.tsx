'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { saveShippingRate, saveShippingZone } from '@/modules/shipping/actions';
import type { AdminRate, AdminZone } from '@/modules/shipping/types';

interface AreaChoices {
  divisions: Array<{ id: string; name: string }>;
  districts: Array<{ id: string; name: string; divisionId: string }>;
}

function RateRow({
  zoneId,
  rate,
  canWrite,
}: {
  zoneId: string;
  rate?: AdminRate;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [values, setValues] = useState({
    name: rate?.name ?? 'Standard delivery',
    rate: rate?.rate ?? '',
    freeOver: rate?.freeOver ?? '',
    minDays: String(rate?.minDays ?? 1),
    maxDays: String(rate?.maxDays ?? 3),
  });
  const [codAllowed, setCodAllowed] = useState(rate?.codAllowed ?? true);
  const [isActive, setIsActive] = useState(rate?.isActive ?? true);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await saveShippingRate({
        ...(rate ? { id: rate.id } : {}),
        zoneId,
        name: values.name,
        rate: values.rate,
        ...(values.freeOver.trim() ? { freeOver: values.freeOver } : {}),
        minDays: Number(values.minDays),
        maxDays: Number(values.maxDays),
        codAllowed,
        isActive,
      });
      if (result.ok) {
        toast.success(rate ? 'Rate saved' : 'Rate added');
        if (!rate) {
          setValues({
            name: 'Standard delivery',
            rate: '',
            freeOver: '',
            minDays: '1',
            maxDays: '3',
          });
        }
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  const text = (key: keyof typeof values, label: string, hint?: string) => (
    <FormField
      label={label}
      hint={hint}
      error={firstError(errors, key)}
      required={key === 'name' || key === 'rate'}
    >
      {(control) => (
        <Input
          {...control}
          value={values[key]}
          disabled={!canWrite}
          inputMode={key === 'name' ? undefined : 'decimal'}
          maxLength={key === 'name' ? 60 : 20}
          onChange={(event) => set(key)(event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={rate ? `Rate ${rate.name}` : 'New rate'}
      className="grid gap-4 border border-line p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">{text('name', 'Rate name')}</div>
      {text('rate', 'Delivery charge (৳)')}
      {text('freeOver', 'Free over (৳)', 'Leave empty for never free.')}
      {text('minDays', 'Earliest (days)')}
      {text('maxDays', 'Latest (days)')}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 sm:col-span-2 lg:col-span-6">
        <Checkbox
          label="Cash on delivery allowed"
          checked={codAllowed}
          disabled={!canWrite}
          onCheckedChange={(value) => setCodAllowed(value === true)}
        />
        <Switch
          label="Active"
          checked={isActive}
          disabled={!canWrite}
          onCheckedChange={setIsActive}
        />
        <div className="ml-auto flex items-center gap-3">
          <p role="alert" className="type-small text-danger-text">
            {formError}
          </p>
          {canWrite ? (
            <Button
              type="submit"
              size="sm"
              loading={pending}
              variant={rate ? 'secondary' : 'primary'}
            >
              {rate ? 'Save rate' : 'Add rate'}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** One zone: its name, the areas it covers (district level), and its rates. */
export function ZoneEditor({
  zone,
  areas,
  canWrite,
}: {
  zone: AdminZone;
  areas: AreaChoices;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState(zone.name);
  const [isActive, setIsActive] = useState(zone.isActive);
  const [selected, setSelected] = useState<Set<string>>(new Set(zone.geoAreaIds));

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await saveShippingZone({
        id: zone.id,
        name,
        geoAreaIds: [...selected],
        isActive,
      });
      if (result.ok) {
        toast.success('Zone saved');
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  return (
    <section
      aria-label={zone.name}
      className="flex flex-col gap-6 border border-line bg-raised p-5 md:p-6"
    >
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="type-h3 text-fg">{zone.name}</h2>
        {zone.isFallback ? <Badge tone="gold">Rest of the country</Badge> : null}
        {!zone.isActive ? <Badge tone="neutral">Off</Badge> : null}
      </header>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Zone name" required error={firstError(errors, 'name')}>
            {(control) => (
              <Input
                {...control}
                value={name}
                disabled={!canWrite}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FormField>
          <Switch
            label="Zone is active"
            checked={isActive}
            disabled={!canWrite || zone.isFallback}
            onCheckedChange={setIsActive}
            className="self-end"
          />
        </div>

        {zone.isFallback ? (
          <p className="type-admin text-fg-muted">
            Serves every address that no other zone names. It cannot be switched off, so every
            customer always gets a delivery quote.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="type-eyebrow text-fg-muted">
              Districts in this zone ({selected.size} chosen)
            </legend>
            <p className="type-admin text-fg-muted">
              A zone that names a district beats the rest-of-country zone for addresses there.
            </p>
            <div className="max-h-72 overflow-y-auto border border-line">
              {areas.divisions.map((division) => {
                const districts = areas.districts.filter((d) => d.divisionId === division.id);
                const count = districts.filter((d) => selected.has(d.id)).length;
                return (
                  <details
                    key={division.id}
                    className="border-b border-line last:border-b-0"
                    open={count > 0}
                  >
                    <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 type-admin text-fg">
                      <span>{division.name}</span>
                      <span className="text-fg-muted">
                        {count} of {districts.length}
                      </span>
                    </summary>
                    <div className="grid gap-x-6 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-3">
                      {districts.map((district) => (
                        <Checkbox
                          key={district.id}
                          label={district.name}
                          checked={selected.has(district.id)}
                          disabled={!canWrite}
                          onCheckedChange={(value) => toggle(district.id, value === true)}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
            {zone.geoAreaIds.length > selected.size || zone.coverage.length === 0 ? null : (
              <p className="type-admin text-fg-muted">Now covering: {zone.coverage.join(', ')}.</p>
            )}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <p role="alert" className="type-small text-danger-text">
            {formError}
          </p>
          {canWrite ? (
            <Button type="submit" size="sm" loading={pending}>
              Save zone
            </Button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <h3 className="type-eyebrow text-fg-muted">Rates</h3>
        {zone.rates.length === 0 ? (
          <p className="type-admin text-fg-muted">
            No rates yet. A zone without a rate cannot deliver anything.
          </p>
        ) : null}
        {zone.rates.map((rate) => (
          <RateRow key={rate.id} zoneId={zone.id} rate={rate} canWrite={canWrite} />
        ))}
        {canWrite ? <RateRow zoneId={zone.id} canWrite /> : null}
      </div>
    </section>
  );
}
