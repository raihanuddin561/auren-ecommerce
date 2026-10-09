'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { requestReturnAction } from '@/modules/returns/actions';
import { RETURN_REASON_LABEL } from '@/modules/returns/schemas';
import type { ReturnOffer } from '@/modules/orders/types';

type Reason = keyof typeof RETURN_REASON_LABEL;

interface Pick {
  selected: boolean;
  quantity: string;
  reason: Reason;
  exchangeVariantId: string;
}

const dayText = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Asia/Dhaka' });

/**
 * "Need to return or exchange something?" on the order page. The request goes to our team, who
 * review it; nothing is refunded or sent until a person agrees. An exchange is another size or
 * colour of the same piece.
 */
export function ReturnRequestForm({ token, offer }: { token: string; offer: ReturnOffer }) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<'return' | 'exchange'>('return');
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      offer.items.map((item) => [
        item.orderItemId,
        { selected: false, quantity: '1', reason: 'too_small' as Reason, exchangeVariantId: '' },
      ]),
    ),
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = offer.items.filter((item) => picks[item.orderItemId]?.selected);
  const patch = (id: string, change: Partial<Pick>) =>
    setPicks((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (chosen.length === 0) {
      setError('Choose the piece you would like to send back.');
      return;
    }
    const items = chosen.map((item) => {
      const pick = picks[item.orderItemId]!;
      return {
        orderItemId: item.orderItemId,
        quantity: Number(pick.quantity),
        reason: pick.reason,
        ...(type === 'exchange' ? { exchangeVariantId: pick.exchangeVariantId } : {}),
      };
    });
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      setError('Enter how many pieces, as a whole number.');
      return;
    }
    if (type === 'exchange' && items.some((item) => !item.exchangeVariantId)) {
      setError('Choose the size or colour you would like instead.');
      return;
    }
    startTransition(async () => {
      try {
        const result = await requestReturnAction({
          token,
          type,
          items,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (result.ok) {
          // The confirmation stays on screen; the order page lists the return on the next visit.
          setDone(result.data.returnNumber);
        } else {
          setError(result.error.message ?? 'We could not send your request. Please try again.');
        }
      } catch {
        setError('We could not send your request. Please try again.');
      }
    });
  }

  if (done) {
    return (
      <section aria-labelledby="return-heading" className="border border-line bg-raised p-6">
        <h2 id="return-heading" className="type-h3 text-fg">
          We have your request
        </h2>
        <p role="status" className="mt-2 type-small text-fg-muted">
          Your reference is {done}. Our team will review it and message you shortly. Nothing is sent
          back or refunded until we have agreed it with you.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="return-heading" className="border border-line bg-raised p-6">
      <h2 id="return-heading" className="type-h3 text-fg">
        Need to return or exchange something?
      </h2>
      <p className="mt-2 type-small text-fg-muted">
        You can ask until {dayText.format(new Date(offer.endsAt))} ({offer.windowDays} days after
        delivery).
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-5" noValidate>
        <fieldset className="flex gap-6">
          <legend className="sr-only">What would you like</legend>
          {(
            [
              ['return', 'A return'],
              ['exchange', 'An exchange for another size'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 type-small text-fg"
            >
              <input
                type="radio"
                name="return-type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="size-4 accent-[var(--color-fg)]"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {offer.items.map((item) => {
            const pick = picks[item.orderItemId]!;
            const canExchange = item.alternatives.length > 0;
            return (
              <li key={item.orderItemId} className="flex flex-col gap-3 py-4">
                <Checkbox
                  label={`${item.title} (${item.variantLabel})`}
                  checked={pick.selected}
                  disabled={type === 'exchange' && !canExchange}
                  description={
                    type === 'exchange' && !canExchange
                      ? 'No other size is available to exchange for right now.'
                      : undefined
                  }
                  onCheckedChange={(value) => patch(item.orderItemId, { selected: value === true })}
                />
                {pick.selected ? (
                  <div className="grid gap-3 pl-8 sm:grid-cols-3">
                    {item.maxQuantity > 1 ? (
                      <FormField label={`How many (up to ${item.maxQuantity})`}>
                        {(control) => (
                          <Input
                            {...control}
                            inputMode="numeric"
                            value={pick.quantity}
                            onChange={(event) =>
                              patch(item.orderItemId, { quantity: event.target.value })
                            }
                          />
                        )}
                      </FormField>
                    ) : null}
                    <FormField label="Why">
                      {(control) => (
                        <NativeSelect
                          {...control}
                          value={pick.reason}
                          onChange={(event) =>
                            patch(item.orderItemId, { reason: event.target.value as Reason })
                          }
                        >
                          {(Object.keys(RETURN_REASON_LABEL) as Reason[]).map((reason) => (
                            <option key={reason} value={reason}>
                              {RETURN_REASON_LABEL[reason]}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                    {type === 'exchange' ? (
                      <FormField label="Exchange for">
                        {(control) => (
                          <NativeSelect
                            {...control}
                            value={pick.exchangeVariantId}
                            onChange={(event) =>
                              patch(item.orderItemId, { exchangeVariantId: event.target.value })
                            }
                          >
                            <option value="">Choose a size</option>
                            {item.alternatives.map((alternative) => (
                              <option key={alternative.variantId} value={alternative.variantId}>
                                {alternative.label}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      </FormField>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <FormField label="Anything we should know" hint="Optional.">
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
        <p role="alert" className="min-h-5 type-small text-danger-text">
          {error}
        </p>
        <div>
          <Button type="submit" loading={pending}>
            Send request
          </Button>
        </div>
      </form>
    </section>
  );
}
