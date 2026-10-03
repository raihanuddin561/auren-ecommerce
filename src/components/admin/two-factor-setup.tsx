'use client';

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormError, SubmitButton } from './field';

type Step = 'password' | 'scan' | 'done';

function secretFromUri(uri: string): string {
  return new URL(uri).searchParams.get('secret') ?? '';
}

export function TwoFactorSetup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: failure } = await authClient.twoFactor.enable({
      password: String(form.get('password') ?? ''),
      method: 'totp',
    });
    if (failure || data?.method !== 'totp') {
      setPending(false);
      return setError(failure?.message ?? 'We could not start setup.');
    }
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }));
    setSecret(secretFromUri(data.totpURI));
    setBackupCodes(data.backupCodes);
    setPending(false);
    setStep('scan');
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
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-5">
        <p className="type-eyebrow text-fg-muted">Step 3 of 3</p>
        <p className="type-body">
          Two-factor authentication is on. Store these backup codes somewhere safe: each one signs
          you in once if you lose your phone.
        </p>
        <ul className="grid grid-cols-2 gap-2 border border-line bg-raised p-4 type-small font-mono">
          {backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Checkbox
          label="I have saved these backup codes"
          checked={saved}
          onCheckedChange={(value) => setSaved(value === true)}
        />
        <Button
          type="button"
          size="lg"
          disabled={!saved}
          onClick={() => {
            router.replace('/admin');
            router.refresh();
          }}
        >
          Continue to admin
        </Button>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <form onSubmit={onCode} className="flex flex-col gap-5" noValidate>
        <p className="type-eyebrow text-fg-muted">Step 2 of 3</p>
        <ol className="list-decimal space-y-1 pl-5 type-small">
          <li>Open an authenticator app (1Password, Authy, Google Authenticator).</li>
          <li>Scan the code below, or choose manual entry and type the key.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL QR code, not a content image */}
        <img src={qr} alt="Two-factor setup QR code" width={192} height={192} />
        <p className="type-small text-fg-muted">
          Cannot scan? Enter this key manually:{' '}
          <code data-testid="totp-manual-key" className="font-mono break-all text-fg">
            {secret}
          </code>
        </p>
        <Field
          label="Authentication code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Turn on</SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} className="flex flex-col gap-5">
      <p className="type-eyebrow text-fg-muted">Step 1 of 3</p>
      <p className="type-small">
        Staff accounts need two-factor authentication before they can use the admin console. You
        will need an authenticator app on your phone. Confirm your password to begin.
      </p>
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>Continue</SubmitButton>
    </form>
  );
}
