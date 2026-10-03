'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Field, FormError, SubmitButton } from './field';

const MIN_LENGTH = 10;

/**
 * Changes the signed-in user's password. The server signs out every other device whatever this
 * form sends, so the copy says so.
 */
export function PasswordChangeForm({ lead }: { lead?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get('currentPassword') ?? '');
    const next = String(form.get('newPassword') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');
    setError(null);
    if (next.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (next === current) return setError('Choose a password you have not used here before.');
    if (next !== confirm) return setError('The two new passwords do not match.');

    setPending(true);
    const { error: failure } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (failure) return setError(failure.message ?? 'We could not change your password.');
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p role="status" className="type-body">
        Your password has been changed. You have been signed out of every other device.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <p className="type-small">
        {lead ?? 'Choose a new password. You will be signed out of every other device.'}
      </p>
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint={`At least ${MIN_LENGTH} characters. A passphrase works well.`}
        required
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>Change password</SubmitButton>
    </form>
  );
}
