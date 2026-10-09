'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormSection } from '@/components/admin/form-section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { saveOrderRulesAction } from '@/modules/settings/actions';
import type { ReturnSettings, VerificationSettings } from '@/modules/settings/schemas';

const NUMBER_FIELDS: Array<{
  key: keyof Pick<
    VerificationSettings,
    'slaMinutes' | 'workStartHour' | 'workEndHour' | 'attemptThreshold' | 'claimMinutes'
  >;
  label: string;
  hint: string;
}> = [
  {
    key: 'slaMinutes',
    label: 'Verification target (working minutes)',
    hint: 'Time from placed to verified. Only working hours count, so a night order is not overdue at 2 a.m.',
  },
  { key: 'workStartHour', label: 'Working day starts (hour, 0 to 23)', hint: 'Shop time, Dhaka.' },
  {
    key: 'workEndHour',
    label: 'Working day ends (hour, 1 to 24)',
    hint: 'For example 21 for 9 p.m.',
  },
  {
    key: 'attemptThreshold',
    label: 'Failed attempts before a manager is told',
    hint: 'The order is flagged for review. It is never cancelled automatically.',
  },
  {
    key: 'claimMinutes',
    label: 'How long a claim holds an order (minutes)',
    hint: 'Another team member can take it over when the time runs out.',
  },
];

/** Verification rules and the return window (OD-11, 6.12, 6.15). Saved together and audited. */
export function OrderRulesForm({
  verification,
  returns,
}: {
  verification: VerificationSettings;
  returns: ReturnSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    slaMinutes: String(verification.slaMinutes),
    workStartHour: String(verification.workStartHour),
    workEndHour: String(verification.workEndHour),
    attemptThreshold: String(verification.attemptThreshold),
    claimMinutes: String(verification.claimMinutes),
    returnWindowDays: String(returns.windowDays),
  });
  const [selfVerify, setSelfVerify] = useState(verification.manualOrdersSelfVerify);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await saveOrderRulesAction({
          slaMinutes: Number(values.slaMinutes),
          workStartHour: Number(values.workStartHour),
          workEndHour: Number(values.workEndHour),
          attemptThreshold: Number(values.attemptThreshold),
          claimMinutes: Number(values.claimMinutes),
          manualOrdersSelfVerify: selfVerify,
          returnWindowDays: Number(values.returnWindowDays),
        });
        if (result.ok) {
          toast.success('Order rules saved');
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
    <form onSubmit={submit} className="flex max-w-4xl flex-col gap-6" noValidate>
      <FormSection
        title="Verification"
        description="Every order is verified by a person. These rules decide when an order counts as overdue and how long a claim holds it. Nothing here confirms or cancels an order."
      >
        {NUMBER_FIELDS.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            hint={field.hint}
            error={firstError(errors, field.key)}
            className="max-w-sm"
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={values[field.key]}
                maxLength={5}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            )}
          </FormField>
        ))}
        <div>
          <Switch
            id="self-verify"
            checked={selfVerify}
            onCheckedChange={setSelfVerify}
            aria-describedby="self-verify-hint"
            label="Let staff verify the manual orders they entered themselves"
          />
          <p id="self-verify-hint" className="type-small text-fg-muted">
            Off by default: a second person checks every manual order.
          </p>
        </div>
      </FormSection>
      <FormSection
        title="Returns"
        description="How many days after delivery a customer can ask to return or exchange."
      >
        <FormField
          label="Return window (days)"
          error={firstError(errors, 'returnWindowDays')}
          className="max-w-sm"
        >
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={values.returnWindowDays}
              maxLength={3}
              onChange={(event) =>
                setValues((current) => ({ ...current, returnWindowDays: event.target.value }))
              }
            />
          )}
        </FormField>
      </FormSection>
      <p role="alert" className="min-h-5 type-small text-danger-text">
        {formError}
      </p>
      <div>
        <Button type="submit" loading={pending}>
          Save order rules
        </Button>
      </div>
    </form>
  );
}
