'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { TurnstileWidget, turnstileConfigured } from '@/components/ui/turnstile-widget';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botResets, setBotResets] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (turnstileConfigured && !botToken) {
      setError('Please complete the security check.');
      return;
    }

    setLoading(true);
    setError(null);

    // Request password reset through Better Auth
    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
      ...(botToken ? { fetchOptions: { headers: { 'x-turnstile-token': botToken } } } : {}),
    });

    setLoading(false);
    if (turnstileConfigured) setBotResets((n) => n + 1);

    // In accordance with security criteria (INV-A10 / no user enumeration), always show success
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">DISPATCH CONFIRMED</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Check Your Email</h1>
        <p className="mt-4 type-body text-fg-muted">
          If an account exists with that email address, an encrypted password reset link has been
          sent. The link expires in 60 minutes.
        </p>
        <div className="mt-8">
          <Link href="/login">
            <Button variant="secondary" className="h-12 w-full text-xs tracking-widest uppercase">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">ACCOUNT RECOVERY</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Reset Password</h1>
        <p className="type-body-sm mt-2 text-fg-muted">
          Enter your registered email address and our security service will send you a recovery
          link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="type-body-sm rounded-xs border border-danger/20 bg-danger/5 px-4 py-3 text-danger"
          >
            {error}
          </div>
        ) : null}

        <FormField label="Email Address" required>
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          )}
        </FormField>

        {turnstileConfigured ? (
          <TurnstileWidget onToken={setBotToken} resetKey={botResets} />
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-xs tracking-widest uppercase"
          disabled={loading}
        >
          {loading ? 'Sending link...' : 'Send Recovery Link'}
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6 text-center">
        <Link
          href="/login"
          className="type-body-sm text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          Remember your password? Sign in
        </Link>
      </div>
    </div>
  );
}
