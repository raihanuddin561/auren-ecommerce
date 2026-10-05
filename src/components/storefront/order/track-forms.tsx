'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { TurnstileWidget, turnstileConfigured } from '@/components/admin/turnstile-widget';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { lookupOrder, unlockOrder } from '@/modules/orders/actions';
import type { MinimalOrderView } from '@/modules/orders/types';
import { OrderTimeline } from './order-timeline';

const FAILURE: Record<string, string> = {
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
};

/** One generic message for every mismatch, so order numbers cannot be probed. */
function failureMessage(code: string, message?: string): string {
  return FAILURE[code] ?? message ?? 'We could not find an order with those details.';
}

/** Order number plus the phone or email used: shows the status only. */
export function LookupForm() {
  const [orderNumber, setOrderNumber] = useState('');
  const [factor, setFactor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<MinimalOrderView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const result = await lookupOrder({
        orderNumber,
        factor,
        ...(token ? { turnstileToken: token } : {}),
      });
      setReset((n) => n + 1);
      if (result.ok) setFound(result.data.order);
      else setError(failureMessage(result.error.code, result.error.message));
    } catch {
      setError('We could not look that up just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
        <FormField label="Order number" required hint="For example AUR-100001.">
          {(control) => (
            <Input
              {...control}
              name="orderNumber"
              autoComplete="off"
              autoCapitalize="characters"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              maxLength={20}
            />
          )}
        </FormField>
        <FormField
          label="Phone number or email used for the order"
          required
          hint="We ask for it so only you can see your order."
        >
          {(control) => (
            <Input
              {...control}
              name="factor"
              autoComplete="off"
              value={factor}
              onChange={(event) => setFactor(event.target.value)}
              maxLength={254}
            />
          )}
        </FormField>
        {turnstileConfigured ? <TurnstileWidget onToken={setToken} resetKey={reset} /> : null}
        {error ? (
          <p role="alert" className="type-small text-danger-text">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={busy} disabled={!orderNumber.trim() || !factor.trim()}>
          Find my order
        </Button>
      </form>

      {found ? (
        <section aria-live="polite" className="max-w-2xl border border-line bg-raised p-6 md:p-8">
          <p className="type-eyebrow text-accent-text">Order {found.orderNumber}</p>
          <h2 className="mt-2 type-h2 text-fg">{found.statusLabel}</h2>
          <div className="mt-8">
            <OrderTimeline timeline={found.timeline} />
          </div>
          <p className="mt-6 type-small text-fg-muted">
            For the full details, open the link in the email we sent you when you placed the order.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** A tracking link asks for the phone or email on the order before showing anything. */
export function UnlockForm({ token }: { token: string }) {
  const router = useRouter();
  const [factor, setFactor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [reset, setReset] = useState(0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await unlockOrder({
        token,
        factor,
        ...(turnstile ? { turnstileToken: turnstile } : {}),
      });
      setReset((n) => n + 1);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(failureMessage(result.error.code, result.error.message));
    } catch {
      setError('We could not check that just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <FormField
        label="Phone number or email used for the order"
        required
        hint="This keeps your order private to you."
      >
        {(control) => (
          <Input
            {...control}
            name="factor"
            autoComplete="off"
            value={factor}
            onChange={(event) => setFactor(event.target.value)}
            maxLength={254}
          />
        )}
      </FormField>
      {turnstileConfigured ? <TurnstileWidget onToken={setTurnstile} resetKey={reset} /> : null}
      {error ? (
        <p role="alert" className="type-small text-danger-text">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} disabled={!factor.trim()}>
        View my order
      </Button>
    </form>
  );
}
