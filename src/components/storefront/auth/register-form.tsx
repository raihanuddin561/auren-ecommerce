'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { TurnstileWidget, turnstileConfigured } from '@/components/ui/turnstile-widget';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/account';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botResets, setBotResets] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (!name || name.length < 2) {
      setError('Please provide your full name.');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (turnstileConfigured && !botToken) {
      setError('Please complete the security check.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: failure } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: next,
      ...(botToken ? { fetchOptions: { headers: { 'x-turnstile-token': botToken } } } : {}),
    });

    setLoading(false);
    if (turnstileConfigured) setBotResets((n) => n + 1);

    if (failure) {
      setError(failure.message ?? 'Could not create account. Please try again.');
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">MEMBERSHIP REGISTERED</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Welcome to AUREN</h1>
        <p className="mt-4 type-body text-fg-muted">
          Your client account has been created. We have dispatched a verification link to your email
          address. Please confirm your email to activate your full privileges.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => router.push('/login')}
            className="h-12 w-full text-xs tracking-widest uppercase"
          >
            Sign In Now
          </Button>
          <Link
            href="/"
            className="type-body-sm text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">JOIN THE INNER CIRCLE</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Create Client Account</h1>
        <p className="mt-2 type-body-sm text-fg-muted">
          Enjoy expedited atelier appointments, doorstep exchange privileges, and bespoke sizing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="rounded-xs border border-danger/20 bg-danger/5 px-4 py-3 type-body-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        <FormField label="Full Name" required>
          {(props) => (
            <Input
              {...props}
              name="name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Raihan Chowdhury"
              required
            />
          )}
        </FormField>

        <FormField label="Email Address" required>
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              required
            />
          )}
        </FormField>

        <FormField
          label="Password"
          hint="Minimum 10 characters for rigorous account security."
          required
        >
          {(props) => (
            <Input
              {...props}
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              required
            />
          )}
        </FormField>

        <FormField label="Confirm Password" required>
          {(props) => (
            <Input
              {...props}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              required
            />
          )}
        </FormField>

        {turnstileConfigured ? (
          <TurnstileWidget onToken={setBotToken} resetKey={botResets} />
        ) : null}

        <p className="type-body-xs text-fg-muted">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-fg underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-fg underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-xs tracking-widest uppercase"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Create Client Account'}
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6 text-center">
        <p className="type-body-sm text-fg-muted">
          Already have a client account?{' '}
          <Link
            href={`/login${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-accent-text underline underline-offset-4 hover:text-accent-text/80"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
