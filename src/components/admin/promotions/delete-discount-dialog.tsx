'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { deleteDiscountAction } from '@/modules/promotions/actions';
import type { DiscountRow } from './discounts-table';

interface DeleteDiscountDialogProps {
  discount: DiscountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDiscountDialog({ discount, open, onOpenChange }: DeleteDiscountDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!discount) return null;

  const hasRedemptions = discount.usageCount > 0;

  async function handleDelete() {
    if (!discount) return;
    setLoading(true);

    const res = await deleteDiscountAction({ id: discount.id });
    setLoading(false);

    if (res.ok) {
      if (res.data.archived) {
        toast.message(
          'Coupon deactivated',
          `Because ${discount.code || discount.title} was redeemed in ${discount.usageCount} order(s), it was deactivated to preserve order receipts.`,
        );
      } else {
        toast.success(
          'Coupon deleted',
          `Promotion ${discount.code || discount.title} has been permanently removed.`,
        );
      }
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error('Deletion failed', res.error.message ?? 'Could not delete promotion.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-danger-text">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>{hasRedemptions ? 'Deactivate Coupon' : 'Delete Coupon'}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-left text-sm text-fg-muted">
            {hasRedemptions ? (
              <span>
                The coupon{' '}
                <strong className="font-mono text-fg">{discount.code || discount.title}</strong> has
                already been redeemed in{' '}
                <strong className="text-fg">{discount.usageCount} order(s)</strong>.
                <br />
                <br />
                To maintain historical order receipts and audit integrity, this action will{' '}
                <strong className="text-fg">permanently deactivate</strong> the coupon and prevent
                any future checkouts with it.
              </span>
            ) : (
              <span>
                Are you sure you want to permanently delete{' '}
                <strong className="font-mono text-fg">{discount.code || discount.title}</strong>?
                <br />
                <br />
                This coupon has not been used in any orders and will be completely removed from the
                system. This action cannot be undone.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={loading}
            disabled={loading}
            onClick={handleDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {hasRedemptions ? 'Confirm Deactivation' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
