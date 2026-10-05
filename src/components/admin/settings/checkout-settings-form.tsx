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
import { saveCheckoutSettings } from '@/modules/settings/actions';
import type { CheckoutSettingsView } from '@/modules/settings/types';

type NumberKey =
  | 'maxOpenOrdersPerPhone'
  | 'maxOrdersPerPhonePerDay'
  | 'maxOpenOrdersPerAddress'
  | 'maxOrdersPerIpPerDay'
  | 'maxUnitsPerVariantPerPhone';

const LIMITS: Array<{ key: NumberKey; label: string; hint: string }> = [
  {
    key: 'maxOpenOrdersPerPhone',
    label: 'Open orders per phone',
    hint: 'Orders from one number still waiting for your team to verify.',
  },
  {
    key: 'maxOrdersPerPhonePerDay',
    label: 'Orders per phone per day',
    hint: 'In the last 24 hours, whatever their status.',
  },
  {
    key: 'maxOpenOrdersPerAddress',
    label: 'Open orders per address',
    hint: 'Same delivery address, any phone number.',
  },
  {
    key: 'maxOrdersPerIpPerDay',
    label: 'Orders per network address per day',
    hint: 'One connection can be many customers; keep this generous.',
  },
  {
    key: 'maxUnitsPerVariantPerPhone',
    label: 'Units of one item per phone',
    hint: 'Stops one buyer holding all the stock of a size while orders wait.',
  },
];

/** Cash on delivery rule and checkout abuse limits. Saved together, audited. */
export function CheckoutSettingsForm({ settings }: { settings: CheckoutSettingsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [codEnabled, setCodEnabled] = useState(settings.codEnabled);
  const [codMaxOrder, setCodMaxOrder] = useState(settings.codMaxOrder);
  const [otpRequired, setOtpRequired] = useState(settings.otpRequired);
  const [limits, setLimits] = useState<Record<NumberKey, string>>({
    maxOpenOrdersPerPhone: String(settings.maxOpenOrdersPerPhone),
    maxOrdersPerPhonePerDay: String(settings.maxOrdersPerPhonePerDay),
    maxOpenOrdersPerAddress: String(settings.maxOpenOrdersPerAddress),
    maxOrdersPerIpPerDay: String(settings.maxOrdersPerIpPerDay),
    maxUnitsPerVariantPerPhone: String(settings.maxUnitsPerVariantPerPhone),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await saveCheckoutSettings({
        otpRequired,
        codEnabled,
        codMaxOrder,
        maxOpenOrdersPerPhone: Number(limits.maxOpenOrdersPerPhone),
        maxOrdersPerPhonePerDay: Number(limits.maxOrdersPerPhonePerDay),
        maxOpenOrdersPerAddress: Number(limits.maxOpenOrdersPerAddress),
        maxOrdersPerIpPerDay: Number(limits.maxOrdersPerIpPerDay),
        maxUnitsPerVariantPerPhone: Number(limits.maxUnitsPerVariantPerPhone),
      });
      if (result.ok) {
        toast.success('Checkout settings saved');
        router.refresh();
        return;
      }
      setErrors(fieldErrorsOf(result));
      setFormError(failureMessage(result));
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormSection
        title="Cash on delivery"
        description="Cash on delivery is how most orders are paid. Large orders can be held back."
      >
        <Switch
          label="Cash on delivery is available"
          checked={codEnabled}
          onCheckedChange={setCodEnabled}
        />
        <FormField
          label="Largest cash on delivery order (৳)"
          required
          hint="Orders above this must be paid another way. Checked again when the order is placed."
          error={firstError(errors, 'codMaxOrder')}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={codMaxOrder}
              maxLength={20}
              onChange={(event) => setCodMaxOrder(event.target.value)}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title="Order limits"
        description="Protect the shop from fake and repeated orders. Orders waiting for verification hold their stock, and the system never cancels one by itself: you cancel, and that frees the slot."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {LIMITS.map((limit) => (
            <FormField
              key={limit.key}
              label={limit.label}
              hint={limit.hint}
              error={firstError(errors, limit.key)}
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={limits[limit.key]}
                  maxLength={3}
                  onChange={(event) =>
                    setLimits((current) => ({ ...current, [limit.key]: event.target.value }))
                  }
                />
              )}
            </FormField>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Phone codes"
        description="Ask customers to confirm their phone with a 6 digit code before an order is placed."
      >
        <div className="flex flex-col gap-1 border border-line p-4">
          <Switch
            label="Require a phone code at checkout"
            checked={otpRequired}
            onCheckedChange={setOtpRequired}
          />
          <p className="type-admin text-fg-muted">
            Off by default. No SMS service is connected yet, so in production codes cannot be sent
            and customers could not check out: leave this off until one is.
          </p>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p role="alert" className="type-small text-danger-text">
          {formError}
        </p>
        <Button type="submit" loading={pending}>
          Save checkout settings
        </Button>
      </div>
    </form>
  );
}
