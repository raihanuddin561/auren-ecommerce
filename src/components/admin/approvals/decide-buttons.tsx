'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { confirmStepUp } from '@/modules/identity/actions';
import { decideApprovalAction } from '@/modules/approvals/actions';
import { APPROVAL_DECIDE_STEP_UP } from '@/modules/approvals/schemas';

/** Approve or reject one request. Needs a fresh password; the person who asked cannot decide. */
export function DecideButtons({
  id,
  disabledReason,
}: {
  id: string;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function decide(decision: 'approved' | 'rejected') {
    setError(null);
    startTransition(async () => {
      try {
        if (needsPassword && password) {
          const confirmed = await confirmStepUp({
            method: 'password',
            purpose: APPROVAL_DECIDE_STEP_UP,
            password,
          });
          if (!confirmed.ok) {
            setError(failureMessage(confirmed));
            return;
          }
          setPassword('');
        }
        const result = await decideApprovalAction({ id, decision });
        if (result.ok) {
          toast.success(decision === 'approved' ? 'Approved' : 'Rejected');
          router.refresh();
          return;
        }
        if (result.error.code === 'STEP_UP_REQUIRED') {
          setNeedsPassword(true);
          setError('Confirm your password to decide.');
          return;
        }
        setError(failureMessage(result));
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  if (disabledReason) return <p className="type-small text-fg-muted">{disabledReason}</p>;
  return (
    <div className="flex flex-col gap-3">
      {needsPassword ? (
        <FormField label="Your password" required>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoFocus
              autoComplete="current-password"
              className="h-10 max-w-xs"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => decide('approved')}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide('rejected')}>
          Reject
        </Button>
      </div>
      <p role="alert" className="min-h-4 type-small text-danger-text">
        {error}
      </p>
    </div>
  );
}
