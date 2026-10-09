'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { TurnstileWidget, turnstileConfigured } from '@/components/ui/turnstile-widget';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/account';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botResets, setBotResets] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');

    if (!email || !password) {
      setError('Please provide both your email and password.');
      return;
    }

    if (turnstileConfigured && !botToken) {
      setError('Please complete the security check.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: failure } = await authClient.signIn.email({
      email,
      password,
      ...(botToken ? { fetchOptions: { headers: { 'x-turnstile-token': botToken } } } : {}),
    });

    setLoading(false);
    if (turnstileConfigured) setBotResets((n) => n + 1);

    if (failure) {
      setError(failure.message ?? 'Invalid email or password. Please try again.');
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">THE HOUSE OF AUREN</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Client Sign In</h1>
        <p className="type-body-sm mt-2 text-fg-muted">
          Access your wardrobe curation, bespoke orders, and concierge preferences.
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
              autoComplete="username"
              placeholder="name@example.com"
              required
            />
          )}
        </FormField>

        <FormField label="Password" required>
          {(props) => (
            <Input
              {...props}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              required
            />
          )}
        </FormField>

        <div className="type-body-sm flex items-center justify-between">
          <Link
            href="/forgot-password"
            className="text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
          >
            Forgot password?
          </Link>
          <Link
            href={`/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-accent-text underline underline-offset-4 transition-colors hover:text-accent-text/80"
          >
            Create account
          </Link>
        </div>

        {turnstileConfigured ? (
          <TurnstileWidget onToken={setBotToken} resetKey={botResets} />
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-xs tracking-widest uppercase"
          disabled={loading}
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6 text-center">
        <p className="type-body-sm text-fg-muted">
          Need assistance with your private client profile?{' '}
          <Link href="/contact" className="text-fg underline underline-offset-4">
            Contact Concierge
          </Link>
        </p>
      </div>
    </div>
  );
}
