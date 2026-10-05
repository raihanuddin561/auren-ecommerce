'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toast';
import { confirmOrderAction, holdOrderAction, cancelOrderAction } from '@/modules/orders/actions';
import { ORDER_CANCEL_REASONS, type OrderCancelReason } from '@/modules/orders/schemas';

interface OrderVerificationPanelProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  canVerify: boolean;
  status: string;
}

export function OrderVerificationPanel({
  orderId,
  customerName,
  customerPhone,
  canVerify,
  status,
}: OrderVerificationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Checklist states
  const [contactChecked, setContactChecked] = useState(false);
  const [itemsChecked, setItemsChecked] = useState(false);
  const [addressChecked, setAddressChecked] = useState(false);
  const [paymentChecked, setPaymentChecked] = useState(false);

  // Form / dialog states
  const [activeDialog, setActiveDialog] = useState<'hold' | 'cancel' | null>(null);
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>('customer_cancelled');

  const allChecked = contactChecked && itemsChecked && addressChecked && paymentChecked;

  const handleConfirm = () => {
    if (!canVerify) return;
    startTransition(async () => {
      const res = await confirmOrderAction({
        orderId,
        note: note ? note.trim() : 'Verified by staff via telephone checklist',
      });
      if (res.ok) {
        toast.success('Order confirmed', 'The order has been verified and sent for fulfillment.');
        router.refresh();
      } else {
        toast.error('Could not confirm order', res.error.message);
      }
    });
  };

  const handleHold = () => {
    if (!canVerify) return;
    startTransition(async () => {
      const res = await holdOrderAction({
        orderId,
        note: note ? note.trim() : 'Customer unreachable, call back scheduled',
      });
      if (res.ok) {
        toast.message('Order placed on hold', 'Verification attempt recorded and order held.');
        setActiveDialog(null);
        setNote('');
        router.refresh();
      } else {
        toast.error('Could not hold order', res.error.message);
      }
    });
  };

  const handleCancel = () => {
    if (!canVerify) return;
    startTransition(async () => {
      const res = await cancelOrderAction({
        orderId,
        reason: cancelReason,
        note: note ? note.trim() : null,
      });
      if (res.ok) {
        toast.warning(
          'Order cancelled',
          'Stock has been returned to inventory and order status updated.',
        );
        setActiveDialog(null);
        setNote('');
        router.refresh();
      } else {
        toast.error('Could not cancel order', res.error.message);
      }
    });
  };

  return (
    <section
      aria-label="Order verification panel"
      className="shadow-sm mb-8 border-2 border-gold/60 bg-raised p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
            <h2 className="type-h3 text-fg">Staff Order Verification</h2>
          </div>
          <p className="mt-1 type-admin text-fg-muted">
            Call <strong className="text-fg">{customerName}</strong> on{' '}
            <a
              href={`tel:${customerPhone}`}
              className="font-medium text-gold-strong underline decoration-gold underline-offset-4 hover:text-gold"
            >
              {customerPhone}
            </a>{' '}
            to verify customer identity, sizes, address and payment.
          </p>
        </div>
        <div className="flex items-center gap-2 border border-line bg-stone-100 px-3 py-1.5 text-xs text-fg-muted dark:bg-stone-800">
          <span>Status:</span>
          <span className="font-semibold tracking-wider text-fg uppercase">
            {status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {canVerify ? (
        <div className="mt-6 border-t border-line/60 pt-5">
          <p className="mb-3 type-eyebrow text-fg-muted">Verification Checklist (INV-O1)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg select-none">
              <Checkbox checked={contactChecked} onCheckedChange={(c) => setContactChecked(!!c)} />
              <span>Customer identity and contact verified</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg select-none">
              <Checkbox checked={itemsChecked} onCheckedChange={(c) => setItemsChecked(!!c)} />
              <span>Items, quantities, colors and sizes confirmed</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg select-none">
              <Checkbox checked={addressChecked} onCheckedChange={(c) => setAddressChecked(!!c)} />
              <span>Delivery address complete and serviceable</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg select-none">
              <Checkbox checked={paymentChecked} onCheckedChange={(c) => setPaymentChecked(!!c)} />
              <span>Payment terms (COD agreed / amount correct)</span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              disabled={!allChecked || isPending}
              loading={isPending}
              onClick={handleConfirm}
              className="text-stone-950 hover:bg-gold-light bg-gold font-medium"
            >
              Confirm order
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setActiveDialog(activeDialog === 'hold' ? null : 'hold')}
            >
              Put on hold
            </Button>

            <Button
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={() => setActiveDialog(activeDialog === 'cancel' ? null : 'cancel')}
            >
              Cancel order
            </Button>

            {!allChecked && (
              <span className="type-small text-fg-muted">
                Tick all 4 checklist points to enable confirmation.
              </span>
            )}
          </div>

          {/* Expandable Hold Form */}
          {activeDialog === 'hold' && (
            <div className="bg-surface mt-4 flex max-w-lg flex-col gap-3 border border-line p-4">
              <h3 className="type-admin font-medium text-fg">Hold Order Details</h3>
              <p className="type-small text-fg-muted">
                Log note for follow-up call. The verification attempt count will be incremented.
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason or scheduled callback time..."
                rows={2}
                className="bg-background w-full border border-line p-2 text-sm text-fg focus:ring-1 focus:ring-gold focus:outline-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={isPending} onClick={handleHold}>
                  Save & Put on hold
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActiveDialog(null);
                    setNote('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Expandable Cancel Form */}
          {activeDialog === 'cancel' && (
            <div className="bg-surface mt-4 flex max-w-lg flex-col gap-3 border border-warning/40 p-4">
              <h3 className="type-admin font-medium text-warning-strong">Cancel Order</h3>
              <p className="type-small text-fg-muted">
                Deducted stock will be automatically returned to inventory (restocked).
              </p>
              <div>
                <label htmlFor="cancel-reason" className="mb-1 block type-small text-fg-muted">
                  Reason for cancellation:
                </label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value as OrderCancelReason)}
                  className="bg-background w-full border border-line p-2 text-sm text-fg focus:ring-1 focus:ring-gold focus:outline-none"
                >
                  {ORDER_CANCEL_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional notes for cancellation..."
                rows={2}
                className="bg-background w-full border border-line p-2 text-sm text-fg focus:ring-1 focus:ring-gold focus:outline-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" disabled={isPending} onClick={handleCancel}>
                  Confirm cancellation
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActiveDialog(null);
                    setNote('');
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 border-t border-line/60 pt-4 text-sm text-fg-muted">
          Your role does not have <code className="text-gold">orders.verify</code> permission to
          confirm or cancel orders.
        </div>
      )}
    </section>
  );
}
