'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { ConfirmDialog } from '@/components/admin/catalog/products/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cancelPurchaseOrder, placePurchaseOrder } from '@/modules/purchasing/actions';

/** Header actions of a purchase order: edit, place, cancel and the PDF download. */
export function PoActions({
  id,
  poNumber,
  can,
  status,
}: {
  id: string;
  poNumber: string;
  can: { edit: boolean; cancel: boolean };
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<'place' | 'cancel' | null>(null);

  function run(kind: 'place' | 'cancel') {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof placePurchaseOrder>>;
      try {
        result =
          kind === 'place' ? await placePurchaseOrder({ id }) : await cancelPurchaseOrder({ id });
      } catch {
        setConfirm(null);
        toast.error('Could not reach the server', 'Nothing was changed. Try again.');
        return;
      }
      if (result.ok) {
        toast.success(kind === 'place' ? `${poNumber} placed` : `${poNumber} cancelled`);
        setConfirm(null);
        router.refresh();
      } else {
        setConfirm(null);
        toast.error('Could not update the order', failureMessage(result) ?? undefined);
      }
    });
  }

  return (
    <>
      {can.edit ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/purchasing/${id}/edit`}>Edit draft</Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary" size="sm">
        {/* A file download, not a page: a plain anchor keeps the router out of it. */}
        <a href={`/admin/purchasing/${id}/pdf`} download>
          Download PDF
        </a>
      </Button>
      {can.cancel ? (
        <Button variant="secondary" size="sm" onClick={() => setConfirm('cancel')}>
          Cancel order
        </Button>
      ) : null}
      {status === 'draft' ? (
        <Button size="sm" onClick={() => setConfirm('place')}>
          Place order
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm === 'place'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Place ${poNumber}?`}
        description="Placing the order marks it as sent to the supplier. Lines can no longer be edited, but you can still add freight and duty and receive goods."
        confirmLabel="Place order"
        pending={pending}
        onConfirm={() => run('place')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Cancel ${poNumber}?`}
        description="Nothing has been received yet. A cancelled order stays on record and cannot be reopened."
        confirmLabel="Cancel order"
        danger
        pending={pending}
        onConfirm={() => run('cancel')}
      />
    </>
  );
}
