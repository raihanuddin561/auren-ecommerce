'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { TurnstileWidget, turnstileConfigured } from '@/components/admin/turnstile-widget';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import { normalizeBdPhone } from '@/lib/phone';
import {
  placeOrder,
  quoteCheckout,
  requestCheckoutCode,
  verifyCheckoutCode,
} from '@/modules/checkout/actions';
import type { CheckoutSummary } from '@/modules/checkout/types';
import { listThanas } from '@/modules/shipping/actions';
import {
  AddressSection,
  ContactSection,
  DeliverySection,
  OtpSection,
  PaymentSection,
} from './checkout-sections';
import { OrderSummaryBody } from './order-summary';
import {
  DRAFT_STORAGE_KEY,
  EMPTY_DRAFT,
  firstInvalid,
  mapServerErrors,
  newIdempotencyKey,
  parseDraft,
  validateDraft,
  validateField,
  type CheckoutDraft,
  type FieldErrors,
  type FieldKey,
} from './validation';

interface CheckoutFormProps {
  initial: CheckoutSummary;
  areas: {
    divisions: Array<{ id: string; name: string }>;
    districts: Array<{ id: string; name: string; divisionId: string }>;
  };
}

type Thanas = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: Array<{ id: string; name: string }>;
};

const FOCUS_NAME: Record<FieldKey, string> = {
  phone: 'phone',
  name: 'name',
  email: 'email',
  divisionId: 'divisionId',
  districtId: 'districtId',
  thana: 'thanaId',
  area: 'area',
  line1: 'line1',
  postalCode: 'postalCode',
  otp: 'otp',
  shippingRateId: 'shippingRateId',
  paymentMethod: 'paymentMethod',
};

function focusField(form: HTMLFormElement | null, key: FieldKey) {
  if (!form) return;
  const names =
    key === 'thana'
      ? ['thanaId', 'thanaName']
      : key === 'divisionId'
        ? ['divisionId', 'divisionName']
        : key === 'districtId'
          ? ['districtId', 'districtName']
          : [FOCUS_NAME[key]];
  for (const name of names) {
    const element = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (element && !(element as HTMLInputElement).disabled) {
      element.focus();
      return;
    }
  }
}

/**
 * The checkout: one page, phone first, no account needed. Everything typed is kept in this tab so a
 * refresh loses nothing, fields are checked as the customer leaves them, and the delivery fee and
 * total come from the server for the address chosen. The browser never sends a price.
 */
export function CheckoutForm({ initial, areas }: CheckoutFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<CheckoutDraft>({ ...EMPTY_DRAFT, idempotencyKey: '' });
  const [restored, setRestored] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary>(initial);
  const [quoteVersion, setQuoteVersion] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state when initial server quote changes
    setSummary(initial);
  }, [initial]);
  const [thanas, setThanas] = useState<Thanas>({ status: 'idle', items: [] });
  const [notListed, setNotListed] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ message: string; bag: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState({
    code: '',
    sent: false,
    verified: false,
    busy: false,
    message: null as string | null,
  });
  const [token, setToken] = useState<string | null>(null);
  const [tokenReset, setTokenReset] = useState(0);

  // Restore what was typed before a refresh, once, after the page has loaded in the browser.
  useEffect(() => {
    let stored: CheckoutDraft | null = null;
    try {
      stored = parseDraft(window.sessionStorage.getItem(DRAFT_STORAGE_KEY));
    } catch {
      stored = null;
    }
    const base = stored ?? { ...EMPTY_DRAFT, idempotencyKey: newIdempotencyKey() };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser storage after hydration
    setDraft(base);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage can be blocked (private windows); the form still works, it just cannot restore.
    }
  }, [draft, restored]);

  // The thanas of the chosen district.
  useEffect(() => {
    if (!restored) return;
    if (!draft.districtId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the district choice
      setThanas({ status: 'idle', items: [] });
      return;
    }
    let cancelled = false;
    setThanas((current) => ({ status: 'loading', items: current.items }));
    listThanas({ parentId: draft.districtId })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) return setThanas({ status: 'error', items: [] });
        setThanas({ status: 'ready', items: result.data });
        setDraft((current) =>
          current.thanaId && !result.data.some((thana) => thana.id === current.thanaId)
            ? { ...current, thanaId: '' }
            : current,
        );
      })
      .catch(() => {
        if (!cancelled) setThanas({ status: 'error', items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [draft.districtId, restored]);

  // Delivery options, payment availability and totals for the address chosen.
  useEffect(() => {
    if (!restored) return;
    const divisionVal = (draft.divisionId || draft.divisionName || '').trim();
    const districtVal = (draft.districtId || draft.districtName || '').trim();
    if (!divisionVal || !districtVal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the address choice
      setSummary(initial);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    quoteCheckout({
      divisionId: divisionVal,
      districtId: districtVal,
      ...(draft.divisionName?.trim() ? { divisionName: draft.divisionName.trim() } : {}),
      ...(draft.districtName?.trim() ? { districtName: draft.districtName.trim() } : {}),
      thanaId: draft.thanaId || null,
      ...(draft.thanaName?.trim() ? { thanaName: draft.thanaName.trim() } : {}),
      ...(draft.shippingRateId ? { shippingRateId: draft.shippingRateId } : {}),
      ...(summary.discount?.code ? { discountCode: summary.discount.code } : {}),
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSummary(result.data);
          const selected = result.data.delivery?.selectedRateId ?? '';
          setDraft((current) =>
            current.shippingRateId === selected
              ? current
              : { ...current, shippingRateId: selected },
          );
        } else {
          setQuoteError(
            result.error.message ??
              'We could not work out delivery for that area. Please try again.',
          );
        }
      })
      .catch(() => {
        if (!cancelled) setQuoteError('We could not work out delivery just now. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    draft.divisionId,
    draft.divisionName,
    draft.districtId,
    draft.districtName,
    draft.thanaId,
    draft.thanaName,
    draft.shippingRateId,
    restored,
    initial,
    quoteVersion,
    summary.discount?.code,
  ]);

  const thanasListed = thanas.items.length > 0;
  const rules = { thanasListed, notListed };

  const change = useCallback((patch: Partial<CheckoutDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFormError(null);
    // A field that was marked wrong is cleared as soon as the customer edits it.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        if (key === 'thanaId' || key === 'thanaName') delete next.thana;
        else delete next[key as FieldKey];
      }
      return next;
    });
  }, []);

  const blur = useCallback(
    (key: FieldKey) => {
      const message = validateField(key, draft, rules);
      setErrors((current) => {
        const next = { ...current };
        if (message) next[key] = message;
        else delete next[key];
        return next;
      });
    },
    // `rules` is rebuilt from two values that are listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, thanasListed, notListed],
  );

  const phoneReady = Boolean(normalizeBdPhone(draft.phone));

  async function sendCode() {
    setOtp((current) => ({ ...current, busy: true, message: null }));
    setErrors((current) => {
      const next = { ...current };
      delete next.otp;
      return next;
    });
    try {
      const result = await requestCheckoutCode({
        phone: draft.phone,
        ...(token ? { turnstileToken: token } : {}),
      });
      setTokenReset((n) => n + 1);
      if (result.ok) {
        setOtp((current) => ({
          ...current,
          busy: false,
          sent: result.data.sent,
          verified: !result.data.required,
          message: result.data.sent ? 'Code sent. It is valid for 5 minutes.' : null,
        }));
      } else {
        setOtp((current) => ({
          ...current,
          busy: false,
          message:
            result.error.code === 'RATE_LIMITED'
              ? 'Too many codes requested. Please wait a few minutes.'
              : (result.error.message ?? 'We could not send the code. Please try again.'),
        }));
      }
    } catch {
      setOtp((current) => ({
        ...current,
        busy: false,
        message: 'We could not send the code. Please try again.',
      }));
    }
  }

  async function confirmCode() {
    setOtp((current) => ({ ...current, busy: true }));
    try {
      const result = await verifyCheckoutCode({ phone: draft.phone, code: otp.code });
      if (result.ok) {
        setOtp((current) => ({ ...current, busy: false, verified: true, message: null }));
        setErrors((current) => {
          const next = { ...current };
          delete next.otp;
          return next;
        });
      } else {
        setOtp((current) => ({ ...current, busy: false }));
        setErrors((current) => ({
          ...current,
          otp:
            result.error.code === 'RATE_LIMITED'
              ? 'Too many tries. Please wait a few minutes and request a new code.'
              : (result.error.message ?? 'That code is not right.'),
        }));
      }
    } catch {
      setOtp((current) => ({ ...current, busy: false }));
      setErrors((current) => ({
        ...current,
        otp: 'We could not check the code. Please try again.',
      }));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validateDraft(draft, rules);
    const cod = summary.methods.find((method) => method.id === 'cod');
    if (cod && !cod.available && summary.delivery)
      found.paymentMethod = cod.reason ?? 'Choose another way to pay.';
    if (summary.otpRequired && !otp.verified)
      found.otp = 'Confirm your phone number with the code we send you.';
    const districtChosen = Boolean(draft.districtId || draft.districtName);
    if (!summary.delivery && !districtChosen)
      found.shippingRateId = 'Choose your district to see delivery options.';
    setErrors(found);
    const first = firstInvalid(found);
    if (first) {
      setFormError(null);
      focusField(formRef.current, first);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const divisionVal = (draft.divisionId || draft.divisionName || '').trim();
      const districtVal = (draft.districtId || draft.districtName || '').trim();
      const thanaListedChoice = !notListed && draft.thanaId;
      const result = await placeOrder({
        idempotencyKey: draft.idempotencyKey,
        contact: {
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
        },
        address: {
          divisionId: divisionVal,
          districtId: districtVal,
          ...(draft.divisionName?.trim() ? { divisionName: draft.divisionName.trim() } : {}),
          ...(draft.districtName?.trim() ? { districtName: draft.districtName.trim() } : {}),
          thanaId: thanaListedChoice ? draft.thanaId : null,
          ...(!thanaListedChoice && draft.thanaName.trim()
            ? { thanaName: draft.thanaName.trim() }
            : {}),
          area: draft.area.trim(),
          line1: draft.line1.trim(),
          ...(draft.line2.trim() ? { line2: draft.line2.trim() } : {}),
          ...(draft.postalCode.trim() ? { postalCode: draft.postalCode.trim() } : {}),
        },
        ...(draft.shippingRateId ? { shippingRateId: draft.shippingRateId } : {}),
        paymentMethod: 'cod',
        ...(draft.note.trim() ? { customerNote: draft.note.trim() } : {}),
        ...(summary.discount?.code ? { discountCode: summary.discount.code } : {}),
        ...(token ? { turnstileToken: token } : {}),
      });
      if (result.ok) {
        try {
          window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // nothing to clean up
        }
        router.push(result.data.redirectTo);
        return;
      }
      setTokenReset((n) => n + 1);
      const mapped = mapServerErrors(result.error.fieldErrors);
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        focusField(formRef.current, firstInvalid(mapped) ?? 'phone');
      }
      const code = result.error.code;
      const stockProblem =
        code === 'OUT_OF_STOCK' || (code === 'CONFLICT' && /bag/i.test(result.error.message ?? ''));
      setFormError({
        message:
          code === 'RATE_LIMITED' && !result.error.message
            ? 'Too many attempts. Please wait a moment and try again.'
            : (result.error.message ??
              'Your order was not placed. Your bag is saved. Please try again.'),
        bag: stockProblem,
      });
      if (code === 'IDEMPOTENCY_KEY_REUSED') {
        // The form changed after an order went through; a new attempt needs a new key.
        setDraft((current) => ({ ...current, idempotencyKey: newIdempotencyKey() }));
      }
    } catch {
      setFormError({
        message: 'We could not place your order just now. Your bag is saved. Please try again.',
        bag: false,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const total = summary.totals.total
    ? deserialize(summary.totals.total)
    : deserialize(summary.totals.subtotal);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <details className="group border border-line bg-raised lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 type-body text-fg">
          <span className="inline-flex items-center gap-2">
            Order summary
            <Icon
              icon={ChevronDown}
              size={16}
              className="transition-transform group-open:rotate-180"
            />
          </span>
          <span className="type-price tabular-nums">{formatPrice(total)}</span>
        </summary>
        <div className="border-t border-line px-4 py-5">
          <OrderSummaryBody
            summary={summary}
            onCouponChange={() => {
              setQuoteVersion((v) => v + 1);
              router.refresh();
            }}
          />
        </div>
      </details>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        aria-label="Checkout"
        className="flex flex-col gap-12 lg:col-span-7"
      >
        <ContactSection draft={draft} errors={errors} change={change} blur={blur} />
        <AddressSection
          draft={draft}
          errors={errors}
          change={change}
          blur={blur}
          areas={areas}
          thanas={thanas}
          notListed={notListed}
          setNotListed={setNotListed}
        />
        <DeliverySection
          summary={summary}
          loading={quoting && !summary.delivery}
          error={quoteError}
          value={draft.shippingRateId}
          onChange={(rateId) => change({ shippingRateId: rateId })}
          fieldError={errors.shippingRateId}
          districtChosen={Boolean(draft.districtId || draft.districtName)}
        />
        <PaymentSection
          summary={summary}
          error={errors.paymentMethod}
          note={draft.note}
          onNote={(value) => change({ note: value })}
        />
        {summary.otpRequired ? (
          <OtpSection
            code={otp.code}
            onCode={(code) => setOtp((current) => ({ ...current, code }))}
            sent={otp.sent}
            verified={otp.verified}
            busy={otp.busy}
            message={otp.message}
            error={errors.otp}
            onSend={sendCode}
            onVerify={confirmCode}
            phoneReady={phoneReady}
          />
        ) : null}

        {turnstileConfigured ? <TurnstileWidget onToken={setToken} resetKey={tokenReset} /> : null}

        {formError ? (
          <div role="alert" className="border border-danger px-4 py-3 type-small text-danger-text">
            <p>{formError.message}</p>
            {formError.bag ? (
              <p className="mt-2">
                <Link href="/cart" className="underline underline-offset-4">
                  Review your bag
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {`Place order · ${formatPrice(total)}`}
          </Button>
          <p className="type-small text-fg-muted">
            Our team will personally confirm your order before we prepare it. You pay when it
            arrives.
          </p>
        </div>
      </form>

      <aside
        aria-label="Order summary"
        className="hidden self-start border border-line bg-raised p-8 lg:sticky lg:top-8 lg:col-span-5 lg:block"
      >
        <h2 className="mb-6 type-h3 text-fg">Order summary</h2>
        <OrderSummaryBody
          summary={summary}
          onCouponChange={() => {
            setQuoteVersion((v) => v + 1);
            router.refresh();
          }}
        />
      </aside>
    </div>
  );
}
