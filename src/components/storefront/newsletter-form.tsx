'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

interface NewsletterFormProps {
  /**
   * Performs the sign-up and resolves to an error message, or null on success. Supplied by the
   * marketing work; until then the form validates and says that sign-ups are not open yet.
   */
  onSubscribe?: (email: string) => Promise<string | null>;
}

type Status = 'idle' | 'sending' | 'done' | 'unavailable';

export function NewsletterForm({ onSubscribe }: NewsletterFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    if (!onSubscribe) {
      setStatus('unavailable');
      return;
    }
    setStatus('sending');
    let failure: string | null;
    try {
      failure = await onSubscribe(email);
    } catch {
      failure = 'We could not sign you up just now. Please try again.';
    }
    if (failure) {
      setError(failure);
      setStatus('idle');
      return;
    }
    setStatus('done');
  }

  const message =
    status === 'done'
      ? 'Thank you. Early access to new collections will reach your inbox.'
      : status === 'unavailable'
        ? 'Sign-ups are not open just yet. Thank you for your interest.'
        : '';
  const finished = status === 'done' || status === 'unavailable';

  return (
    <>
      {finished ? null : (
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <FormField label="Email address" error={error} hideLabel className="flex-1">
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Your email address"
              />
            )}
          </FormField>
          <Button type="submit" size="md" loading={status === 'sending'} className="sm:mt-0">
            Subscribe
          </Button>
        </form>
      )}
      {/* Always mounted so assistive tech announces the text when it changes. */}
      <p role="status" aria-live="polite" className="type-body text-fg">
        {message}
      </p>
    </>
  );
}
