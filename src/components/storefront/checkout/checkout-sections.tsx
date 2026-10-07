'use client';

import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { formatPrice } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import type { CheckoutSummary } from '@/modules/checkout/types';
import { NativeSelect } from './native-select';
import type { CheckoutDraft, FieldErrors, FieldKey } from './validation';

export function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${step}`} className="flex flex-col gap-5">
      <div>
        <p className="type-eyebrow text-accent-text">Step {step}</p>
        <h2 id={`step-${step}`} className="mt-1 type-h3 text-fg">
          {title}
        </h2>
        {description ? <p className="mt-1 type-small text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface FieldProps {
  draft: CheckoutDraft;
  errors: FieldErrors;
  change: (patch: Partial<CheckoutDraft>) => void;
  blur: (key: FieldKey) => void;
}

export function ContactSection({ draft, errors, change, blur }: FieldProps) {
  return (
    <Section
      step={1}
      title="Contact"
      description="Our team calls this number to confirm your order before we prepare it."
    >
      <FormField label="Mobile number" required error={errors.phone}>
        {(control) => (
          <Input
            {...control}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01712 345678"
            value={draft.phone}
            onChange={(event) => change({ phone: event.target.value })}
            onBlur={() => blur('phone')}
            maxLength={20}
          />
        )}
      </FormField>
      <FormField label="Full name" required error={errors.name}>
        {(control) => (
          <Input
            {...control}
            name="name"
            autoComplete="name"
            value={draft.name}
            onChange={(event) => change({ name: event.target.value })}
            onBlur={() => blur('name')}
            maxLength={80}
          />
        )}
      </FormField>
      <FormField
        label="Email"
        hint="Optional. We send your order details here."
        error={errors.email}
      >
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draft.email}
            onChange={(event) => change({ email: event.target.value })}
            onBlur={() => blur('email')}
            maxLength={120}
          />
        )}
      </FormField>
    </Section>
  );
}

interface AddressProps extends FieldProps {
  areas: {
    divisions: Array<{ id: string; name: string }>;
    districts: Array<{ id: string; name: string; divisionId: string }>;
  };
  thanas: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    items: Array<{ id: string; name: string }>;
  };
  notListed: boolean;
  setNotListed: (value: boolean) => void;
}

export function AddressSection({
  draft,
  errors,
  change,
  blur,
  areas,
  thanas,
  notListed,
  setNotListed,
}: AddressProps) {
  const districts = areas.districts.filter((district) => district.divisionId === draft.divisionId);
  const listed = thanas.items.length > 0;
  const typeIt = notListed || (thanas.status === 'ready' && !listed) || thanas.status === 'error';

  return (
    <Section step={2} title="Delivery address" description="Where should we bring your order?">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Division" required error={errors.divisionId}>
          {(control) => (
            <NativeSelect
              {...control}
              name="divisionId"
              autoComplete="address-level1"
              invalid={Boolean(errors.divisionId)}
              value={draft.divisionId}
              onChange={(event) =>
                change({
                  divisionId: event.target.value,
                  districtId: '',
                  thanaId: '',
                  thanaName: '',
                  shippingRateId: '',
                })
              }
              onBlur={() => blur('divisionId')}
            >
              <option value="">Choose a division</option>
              {areas.divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField label="District" required error={errors.districtId}>
          {(control) => (
            <NativeSelect
              {...control}
              name="districtId"
              autoComplete="address-level2"
              invalid={Boolean(errors.districtId)}
              disabled={!draft.divisionId}
              value={draft.districtId}
              onChange={(event) =>
                change({
                  districtId: event.target.value,
                  thanaId: '',
                  thanaName: '',
                  shippingRateId: '',
                })
              }
              onBlur={() => blur('districtId')}
            >
              <option value="">
                {draft.divisionId ? 'Choose a district' : 'Choose a division first'}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>

      {typeIt ? (
        <FormField
          label="Thana or upazila"
          required
          hint={
            listed ? undefined : 'We have not listed the areas of this district yet. Type yours.'
          }
          error={errors.thana}
        >
          {(control) => (
            <Input
              {...control}
              name="thanaName"
              disabled={!draft.districtId}
              value={draft.thanaName}
              onChange={(event) => change({ thanaName: event.target.value, thanaId: '' })}
              onBlur={() => blur('thana')}
              maxLength={60}
            />
          )}
        </FormField>
      ) : (
        <FormField label="Thana or upazila" required error={errors.thana}>
          {(control) => (
            <NativeSelect
              {...control}
              name="thanaId"
              invalid={Boolean(errors.thana)}
              disabled={!draft.districtId || thanas.status === 'loading'}
              value={draft.thanaId}
              onChange={(event) => change({ thanaId: event.target.value, thanaName: '' })}
              onBlur={() => blur('thana')}
            >
              <option value="">
                {!draft.districtId
                  ? 'Choose a district first'
                  : thanas.status === 'loading'
                    ? 'Loading areas...'
                    : 'Choose a thana or upazila'}
              </option>
              {thanas.items.map((thana) => (
                <option key={thana.id} value={thana.id}>
                  {thana.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      {listed && draft.districtId ? (
        <Button
          type="button"
          variant="link"
          size="none"
          className="self-start type-small"
          onClick={() => {
            setNotListed(!notListed);
            change({ thanaId: '', thanaName: '' });
          }}
        >
          {notListed ? 'Choose from the list instead' : 'My area is not in the list'}
        </Button>
      ) : null}

      <FormField label="Area or neighbourhood" required error={errors.area}>
        {(control) => (
          <Input
            {...control}
            name="area"
            autoComplete="address-level3"
            value={draft.area}
            onChange={(event) => change({ area: event.target.value })}
            onBlur={() => blur('area')}
            maxLength={80}
          />
        )}
      </FormField>
      <FormField
        label="House, road and landmark"
        required
        hint="For example: House 12, Road 4, near the green mosque."
        error={errors.line1}
      >
        {(control) => (
          <Input
            {...control}
            name="line1"
            autoComplete="address-line1"
            value={draft.line1}
            onChange={(event) => change({ line1: event.target.value })}
            onBlur={() => blur('line1')}
            maxLength={160}
          />
        )}
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Flat or floor" hint="Optional.">
          {(control) => (
            <Input
              {...control}
              name="line2"
              autoComplete="address-line2"
              value={draft.line2}
              onChange={(event) => change({ line2: event.target.value })}
              maxLength={160}
            />
          )}
        </FormField>
        <FormField label="Postal code" hint="Optional." error={errors.postalCode}>
          {(control) => (
            <Input
              {...control}
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              value={draft.postalCode}
              onChange={(event) => change({ postalCode: event.target.value })}
              onBlur={() => blur('postalCode')}
              maxLength={4}
            />
          )}
        </FormField>
      </div>
    </Section>
  );
}

export function DeliverySection({
  summary,
  loading,
  error,
  value,
  onChange,
  fieldError,
  districtChosen,
}: {
  summary: CheckoutSummary;
  loading: boolean;
  error: string | null;
  value: string;
  onChange: (rateId: string) => void;
  fieldError?: string | undefined;
  districtChosen: boolean;
}) {
  const options = summary.delivery?.options ?? [];
  return (
    <Section step={3} title="Delivery method">
      {!districtChosen ? (
        <p className="type-small text-fg-muted">Choose your district to see delivery options.</p>
      ) : loading ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-14" />
        </div>
      ) : error ? (
        <p role="alert" className="type-small text-danger-text">
          {error}
        </p>
      ) : (
        <RadioGroup
          name="shippingRateId"
          aria-label="Delivery method"
          value={value || summary.delivery?.selectedRateId || ''}
          onValueChange={onChange}
          className="gap-3"
        >
          {options.map((option) => (
            <div
              key={option.rateId}
              className={cn(
                'flex items-start justify-between gap-4 border px-4 py-3',
                (value || summary.delivery?.selectedRateId) === option.rateId
                  ? 'border-fg'
                  : 'border-line-strong',
              )}
            >
              <RadioItem
                value={option.rateId}
                label={option.name}
                description={`${option.eta}${option.free ? ' · complimentary on this order' : ''}`}
              />
              <p className="pt-2 type-small text-fg tabular-nums">
                {option.free || deserialize(option.charge).minor === 0n
                  ? 'Free'
                  : formatPrice(deserialize(option.charge))}
              </p>
            </div>
          ))}
        </RadioGroup>
      )}
      {fieldError ? (
        <p role="alert" className="type-small text-danger-text">
          {fieldError}
        </p>
      ) : null}
    </Section>
  );
}

export function PaymentSection({
  summary,
  error,
  note,
  onNote,
}: {
  summary: CheckoutSummary;
  error?: string | undefined;
  note: string;
  onNote: (value: string) => void;
}) {
  const cod = summary.methods.find((method) => method.id === 'cod');
  return (
    <Section step={4} title="Payment">
      <RadioGroup name="paymentMethod" aria-label="Payment method" value="cod" className="gap-3">
        <div className="bg-surface/30 border border-fg/80 p-4 transition-colors">
          <div className="flex flex-col gap-2">
            <RadioItem
              value="cod"
              disabled={cod ? !cod.available : false}
              label={cod?.label ?? 'Cash on Delivery (Doorstep)'}
              description="Pay only when your parcel arrives at your doorstep."
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
              <span className="type-caption mr-1 text-fg-muted">Accepted:</span>
              <span className="rounded bg-surface-raised border border-line px-2 py-0.5 text-[10px] font-medium tracking-wide text-fg/80">
                Cash
              </span>
              <span className="rounded border border-[#E2136E]/20 bg-[#E2136E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E2136E]">
                bKash
              </span>
              <span className="rounded border border-[#F7941D]/20 bg-[#F7941D]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F7941D]">
                Nagad
              </span>
              <span className="rounded bg-surface-raised border border-line px-2 py-0.5 text-[10px] font-medium text-fg/70">
                Card at Doorstep
              </span>
            </div>
          </div>
        </div>
      </RadioGroup>

      {/* Doorstep Inspection Guarantee Card */}
      <div className="rounded border-line-subtle bg-surface/40 flex items-start gap-3 border p-3.5 text-fg">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
        <div className="text-xs leading-relaxed text-fg-muted">
          <span className="mb-0.5 block font-medium text-fg">
            100% Doorstep Inspection Guarantee
          </span>
          Inspect your pieces upon delivery. If the fit or feel is not completely satisfactory,
          return directly with the courier without hassle.
        </div>
      </div>

      {cod && !cod.available ? (
        <p role="alert" className="type-small text-danger-text">
          {cod.reason}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="type-small text-danger-text">
          {error}
        </p>
      ) : null}
      <FormField
        label="Note for our team"
        hint="Optional. For example a delivery time that suits you."
      >
        {(control) => (
          <Textarea
            {...control}
            name="note"
            rows={3}
            value={note}
            onChange={(event) => onNote(event.target.value)}
            maxLength={300}
          />
        )}
      </FormField>
    </Section>
  );
}

export function OtpSection({
  code,
  onCode,
  sent,
  verified,
  busy,
  message,
  error,
  onSend,
  onVerify,
  phoneReady,
}: {
  code: string;
  onCode: (value: string) => void;
  sent: boolean;
  verified: boolean;
  busy: boolean;
  message: string | null;
  error?: string | undefined;
  onSend: () => void;
  onVerify: () => void;
  phoneReady: boolean;
}) {
  return (
    <Section
      step={5}
      title="Confirm your phone"
      description="We send a 6 digit code to the number you gave us. It helps us keep orders genuine."
    >
      {verified ? (
        <p role="status" className="type-body text-fg">
          Your number is confirmed.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busy}
              disabled={!phoneReady}
              onClick={onSend}
            >
              {sent ? 'Send a new code' : 'Send code'}
            </Button>
            {!phoneReady ? (
              <span className="type-small text-fg-muted">
                Enter your mobile number above first.
              </span>
            ) : null}
          </div>
          {sent ? (
            <div className="flex flex-wrap items-start gap-3">
              <FormField label="6 digit code" error={error} className="w-44">
                {(control) => (
                  <Input
                    {...control}
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))}
                  />
                )}
              </FormField>
              <Button
                type="button"
                size="sm"
                className="mt-7"
                loading={busy}
                disabled={code.length !== 6}
                onClick={onVerify}
              >
                Confirm
              </Button>
            </div>
          ) : error ? (
            <p role="alert" className="type-small text-danger-text">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="type-small text-fg-muted">
              {message}
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}
