'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Field, FormError, SubmitButton } from './field';
import { TurnstileWidget, turnstileConfigured } from './turnstile-widget';

type Step = 'credentials' | 'code';

/** Only same-site admin paths are allowed as a post-login destination. */
function safeNext(next: string | undefined): string {
  if (!next) return '/admin';
  const base = 'http://admin.invalid';
  try {
    const url = new URL(next, base);
    const inAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    return url.origin === base && inAdmin && !next.includes('\\')
      ? `${url.pathname}${url.search}`
      : '/admin';
  } catch {
    return '/admin';
  }
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botResets, setBotResets] = useState(0);

  const finish = () => {
    router.replace(safeNext(next));
    router.refresh();
  };

  async function onCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    if (turnstileConfigured && !botToken) {
      setPending(false);
      return setError('Please wait for the security check to finish.');
    }
    const { data, error: failure } = await authClient.signIn.email({
      email: String(form.get('email') ?? '')
        .trim()
        .toLowerCase(),
      password: String(form.get('password') ?? ''),
      ...(botToken ? { fetchOptions: { headers: { 'x-turnstile-token': botToken } } } : {}),
    });
    setPending(false);
    // Tokens are single use: ask for a fresh check before the next try.
    if (turnstileConfigured) setBotResets((n) => n + 1);
    if (failure) return setError(failure.message ?? 'We could not sign you in.');
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return setStep('code');
    finish();
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.twoFactor.verifyTotp({
      code: String(form.get('code') ?? '').replace(/\s/g, ''),
    });
    setPending(false);
    if (failure) return setError(failure.message ?? 'That code did not work.');
    finish();
  }

  if (step === 'code') {
    return (
      <form onSubmit={onCode} className="flex flex-col gap-5" noValidate>
        <Field
          label="Authentication code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          hint="Open your authenticator app and enter the 6-digit code."
          required
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Verify</SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={onCredentials} className="flex flex-col gap-5">
      <Field label="Email" name="email" type="email" autoComplete="username" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {turnstileConfigured ? <TurnstileWidget onToken={setBotToken} resetKey={botResets} /> : null}
      <FormError message={error} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}
