'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { blockCustomerAction, unblockCustomerAction } from '@/modules/customer/actions';

interface CustomerBlockDialogProps {
  customerId: string;
  customerName: string;
  isBlocked: boolean;
  canWrite: boolean;
}

export function CustomerBlockDialog({
  customerId,
  customerName,
  isBlocked,
  canWrite,
}: CustomerBlockDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canWrite) return null;

  async function handleToggleStatus() {
    setError(null);
    startTransition(async () => {
      if (isBlocked) {
        const result = await unblockCustomerAction({ customerId });
        if (!result.ok) {
          setError(result.error.message || 'Failed to restore customer account.');
          return;
        }
        toast.success(`Account for ${customerName} has been restored.`);
        setOpen(false);
        router.refresh();
      } else {
        if (!reason.trim() || reason.trim().length < 3) {
          setError('Please provide a reason of at least 3 characters.');
          return;
        }
        const result = await blockCustomerAction({ customerId, reason: reason.trim() });
        if (!result.ok) {
          setError(result.error.message || 'Failed to block customer account.');
          return;
        }
        toast.success(`Account for ${customerName} has been blocked.`);
        setOpen(false);
        setReason('');
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isBlocked ? (
          <Button variant="secondary" size="sm" className="gap-2">
            <Icon icon={CheckCircle2} size={16} />
            Restore account
          </Button>
        ) : (
          <Button variant="danger" size="sm" className="gap-2">
            <Icon icon={Ban} size={16} />
            Block account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBlocked ? 'Restore Customer Account' : 'Block Customer Account'}
          </DialogTitle>
          <DialogDescription>
            {isBlocked
              ? `Restore access for ${customerName}. The customer will be able to sign in and place orders again.`
              : `Blocking ${customerName} will immediately invalidate all active sessions and prevent sign-in and checkout.`}
          </DialogDescription>
        </DialogHeader>

        {!isBlocked ? (
          <div className="my-4 flex flex-col gap-2">
            <label htmlFor="block-reason" className="type-eyebrow text-fg">
              Reason for restriction <span className="text-danger">*</span>
            </label>
            <Input
              id="block-reason"
              placeholder="e.g. Repeated fraudulent COD orders, abuse of atelier staff"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              maxLength={200}
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="my-2 type-small text-danger-text">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={isBlocked ? 'primary' : 'danger'}
            onClick={handleToggleStatus}
            disabled={pending}
          >
            {pending ? 'Updating...' : isBlocked ? 'Confirm Restoration' : 'Confirm Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
