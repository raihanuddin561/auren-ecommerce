'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
import { FormSection } from '@/components/admin/form-section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { createManualOrderAction } from '@/modules/checkout/actions';
import { CHANNEL_LABEL, MANUAL_CHANNELS, type ManualChannel } from '@/modules/orders/schemas';
import { AddressFields, addressPayload, EMPTY_ADDRESS, type AreaLists } from './address-fields';
import { LinesEditor, type LineDraft } from './lines-editor';

/**
 * Staff enter an order that came in by phone, Facebook, Instagram, WhatsApp or in store. The order
 * goes through the same verification queue as a website order; prices, costs, delivery and stock
 * are decided by the server.
 */
export function ManualOrderForm({
  areas,
  selfVerify,
}: {
  areas: AreaLists;
  /** Whether the owner lets the creator confirm their own manual orders. */
  selfVerify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => `manual-${crypto.randomUUID()}`);
  const [channel, setChannel] = useState<ManualChannel>('manual');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const quantities = lines.map((line) => Number(line.quantity));
    if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1)) {
      setErrors({ lines: ['Every quantity must be a whole number of at least 1.'] });
      return;
    }
    startTransition(async () => {
      try {
        const result = await createManualOrderAction({
          idempotencyKey,
          channel,
          contact: {
            name: name.trim(),
            phone: phone.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
          },
          address: addressPayload(address, areas),
          lines: lines.map((line, index) => ({
            variantId: line.variantId,
            quantity: quantities[index]!,
          })),
          ...(note.trim() ? { customerNote: note.trim() } : {}),
        });
        if (result.ok) {
          toast.success(
            `Order ${result.data.orderNumber} entered`,
            selfVerify
              ? 'It is in the verification queue.'
              : 'It is in the verification queue. A different team member will verify it.',
          );
          router.push(`/admin/orders/verification?order=${result.data.orderId}`);
          return;
        }
        setErrors(fieldErrorsOf(result));
        setFormError(failureMessage(result));
      } catch {
        setFormError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-4xl flex-col gap-6" noValidate>
      <FormSection
        title="Where the order came from"
        description="It shows in the order list and on the invoice channel. Every order is still verified by a person."
      >
        <FormField label="Channel" required className="max-w-xs">
          {(control) => (
            <NativeSelect
              {...control}
              value={channel}
              onChange={(event) => setChannel(event.target.value as ManualChannel)}
            >
              {MANUAL_CHANNELS.map((id) => (
                <option key={id} value={id}>
                  {CHANNEL_LABEL[id]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </FormSection>

      <FormSection title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={firstError(errors, 'contact.name')}>
            {(control) => (
              <Input
                {...control}
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Mobile number"
            required
            hint="For example 01712 345678."
            error={firstError(errors, 'contact.phone')}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="tel"
                value={phone}
                maxLength={30}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Email"
            hint="Optional. Order updates are sent here."
            error={firstError(errors, 'contact.email')}
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                value={email}
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Delivery address">
        <AddressFields value={address} onChange={setAddress} areas={areas} errors={errors} />
      </FormSection>

      <FormSection
        title="Items"
        description="Prices come from the catalogue and delivery from the shipping rates when you save."
      >
        <LinesEditor lines={lines} onChange={setLines} error={firstError(errors, 'lines')} />
      </FormSection>

      <FormSection title="Note">
        <FormField label="Note from the customer" hint="Optional.">
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </FormField>
      </FormSection>

      <p role="alert" className="min-h-5 type-small text-danger-text">
        {formError}
      </p>
      <div className="flex gap-3">
        <Button type="submit" loading={pending} disabled={lines.length === 0}>
          Enter order
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/orders')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
