'use client';

import { useState, useTransition } from 'react';
import { failureMessage, fieldErrorsOf } from '@/components/admin/action-feedback';
import type { ActionResult } from '@/lib/action-result';
import { confirmStepUp } from '@/modules/identity/actions';
import { REFUND_STEP_UP } from '@/modules/payments/schemas';
import { requestRefundApprovalAction } from '@/modules/payments/actions';

/**
 * The two gates in front of money going back to a customer (INV-A6): a fresh password confirmation
 * and, above the threshold, a second person's approval. The server enforces both; this hook only
 * walks the staff member through them: it shows the password field when the server asks for it,
 * and offers to send the request to a manager when approval is required.
 */
export function useMoneyGate(onDone: () => void) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalSent, setApprovalSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<ActionResult<unknown>>) {
    setErrors({});
    setError(null);
    startTransition(async () => {
      try {
        if (needsPassword && password) {
          const confirmed = await confirmStepUp({
            method: 'password',
            purpose: REFUND_STEP_UP,
            password,
          });
          if (!confirmed.ok) {
            setError(failureMessage(confirmed));
            return;
          }
          setPassword('');
        }
        const result = await work();
        if (result.ok) {
          onDone();
          return;
        }
        if (result.error.code === 'STEP_UP_REQUIRED') {
          setNeedsPassword(true);
          setError('Confirm your password to send money back to a customer.');
          return;
        }
        if (result.error.code === 'APPROVAL_REQUIRED') {
          setNeedsApproval(true);
          setError(
            'This amount needs a second person to approve it first. Send it to a manager, then try again once it is approved.',
          );
          return;
        }
        setErrors(fieldErrorsOf(result));
        setError(failureMessage(result));
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  function askForApproval(input: { orderId: string; amount: string; reason: string }) {
    startTransition(async () => {
      try {
        const result = await requestRefundApprovalAction(input);
        if (result.ok) {
          setApprovalSent(true);
          setError('Sent to a manager. You can refund once they approve it.');
        } else if (result.error.code === 'STEP_UP_REQUIRED') {
          setNeedsPassword(true);
          setError('Confirm your password, then ask for approval again.');
        } else {
          setError(failureMessage(result));
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return {
    pending,
    password,
    setPassword,
    needsPassword,
    needsApproval,
    approvalSent,
    errors,
    error,
    run,
    askForApproval,
  };
}
