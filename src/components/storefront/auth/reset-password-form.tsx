'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('Invalid or expired reset token. Please request a new recovery link.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (!password || password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: failure } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (failure) {
      setError(failure.message ?? 'Failed to reset password. The link may have expired.');
      return;
    }

    setSuccess(true);
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <span className="type-eyebrow tracking-widest text-danger">INVALID TOKEN</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Recovery Link Expired</h1>
        <p className="mt-4 type-body text-fg-muted">
          This password reset link is invalid or has expired. Please request a fresh link.
        </p>
        <div className="mt-8">
          <Link href="/forgot-password">
            <Button variant="primary" className="h-12 w-full text-xs tracking-widest uppercase">
              Request New Link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">PASSWORD UPDATED</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Security Credentials Saved</h1>
        <p className="mt-4 type-body text-fg-muted">
          Your password has been successfully reset. Any existing active sessions have been
          terminated for your safety.
        </p>
        <div className="mt-8">
          <Button
            variant="primary"
            onClick={() => router.push('/login')}
            className="h-12 w-full text-xs tracking-widest uppercase"
          >
            Sign In Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <span className="type-eyebrow tracking-widest text-accent-text">SECURITY PROTOCOL</span>
        <h1 className="mt-2 type-h1 font-display text-fg">Set New Password</h1>
        <p className="type-body-sm mt-2 text-fg-muted">
          Create a new password of at least 10 characters to safeguard your client account.
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

        <FormField
          label="New Password"
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
              placeholder="Confirm new password"
              required
            />
          )}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-xs tracking-widest uppercase"
          disabled={loading}
        >
          {loading ? 'Updating password...' : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}
