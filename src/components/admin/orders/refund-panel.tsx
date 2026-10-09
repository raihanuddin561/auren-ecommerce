'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, firstError } from '@/components/admin/action-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/components/ui/price';
import { toast } from '@/components/ui/toast';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { deserialize, toDecimalString, type SerializedMoney } from '@/lib/money';
import { declineRefundAction, refundOrderAction } from '@/modules/payments/actions';
import type { AdminOrderDetail, DetailRefund } from '@/modules/orders/admin-types';
import { useMoneyGate } from './use-money-gate';

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });
const money = (value: SerializedMoney) => formatPrice(deserialize(value));

const METHOD_LABEL: Record<string, string> = {
  manual_bkash: 'Sent by bKash',
  original: 'Original payment method',
  store_credit: 'Store credit',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'outline' | 'neutral'> = {
  succeeded: 'success',
  requested: 'warning',
  failed: 'outline',
  cancelled: 'neutral',
};

/**
 * Payment and refunds on the order page (5.4, 5.5). Cash on delivery is collected when the parcel
 * is delivered; refunds are recorded here with a method (the money is sent by hand, for example
 * by bKash, or kept as store credit), update the payment status and the order totals, and need a
 * fresh password, and above the threshold a manager's approval.
 */
export function RefundPanel({
  order,
  canRefund,
}: {
  order: Pick<
    AdminOrderDetail,
    | 'id'
    | 'orderNumber'
    | 'paid'
    | 'refunded'
    | 'refundable'
    | 'refunds'
    | 'payments'
    | 'paymentStatus'
    | 'total'
  >;
  canRefund: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DetailRefund | null>(null);
  const requests = order.refunds.filter((refund) => refund.status === 'requested');
  const refundableMinor = BigInt(order.refundable.minor);
  const paidMinor = BigInt(order.paid.minor);

  return (
    <section aria-labelledby="payment-heading" className="border border-line bg-raised p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="payment-heading" className="type-eyebrow text-fg-muted">
          Payment
        </h2>
        {canRefund && paidMinor > 0n && refundableMinor > 0n ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setTarget(null);
              setOpen(true);
            }}
          >
            Record a refund
          </Button>
        ) : null}
      </div>
      {order.payments.map((payment, index) => (
        <p key={`${payment.createdAt}-${index}`} className="type-admin text-fg">
          {payment.provider === 'cod' ? 'Cash on delivery' : payment.provider}:{' '}
          {money(payment.amount)} <span className="text-fg-muted">({payment.status})</span>
        </p>
      ))}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 type-small">
        <dt className="text-fg-muted">Collected</dt>
        <dd className="text-right tabular-nums">{money(order.paid)}</dd>
        <dt className="text-fg-muted">Refunded</dt>
        <dd className="text-right tabular-nums">{money(order.refunded)}</dd>
        <dt className="text-fg-muted">Status</dt>
        <dd className="text-right capitalize">{order.paymentStatus.replaceAll('_', ' ')}</dd>
      </dl>
      {paidMinor === 0n ? (
        <p className="mt-3 type-small text-fg-muted">
          Cash on delivery is collected when the courier delivers. Nothing can be refunded before
          then.
        </p>
      ) : null}

      {order.refunds.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-3">
          {order.refunds.map((refund) => (
            <li key={refund.id} className="type-admin">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg tabular-nums">{money(refund.amount)}</span>
                <Badge tone={STATUS_TONE[refund.status] ?? 'outline'}>
                  {refund.status === 'requested' ? 'Waiting for a person' : refund.status}
                </Badge>
              </div>
              <p className="type-small text-fg-muted">
                {refund.reason} · {METHOD_LABEL[refund.method] ?? refund.method} ·{' '}
                {dateTime.format(new Date(refund.processedAt ?? refund.createdAt))}
              </p>
              {refund.status === 'requested' && canRefund ? (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setTarget(refund);
                      setOpen(true);
                    }}
                  >
                    Process
                  </Button>
                  <DeclineButton orderId={order.id} refundId={refund.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {requests.length > 0 && !canRefund ? (
        <p className="mt-3 type-small text-fg-muted">
          A refund is waiting. Someone with refund rights needs to process it.
        </p>
      ) : null}

      <RefundDialog
        key={target?.id ?? 'new'}
        open={open}
        onClose={() => setOpen(false)}
        order={order}
        request={target}
      />
    </section>
  );
}

function DeclineButton({ orderId, refundId }: { orderId: string; refundId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await declineRefundAction({
            orderId,
            refundId,
            note: 'Declined by staff: no refund is due.',
          });
          if (result.ok) {
            toast.message('Refund request closed');
            router.refresh();
          } else {
            toast.error('Could not close the request', failureMessage(result) ?? undefined);
          }
        })
      }
    >
      No refund due
    </Button>
  );
}

function RefundDialog({
  open,
  onClose,
  order,
  request,
}: {
  open: boolean;
  onClose: () => void;
  order: Pick<AdminOrderDetail, 'id' | 'orderNumber' | 'refundable'>;
  request: DetailRefund | null;
}) {
  const router = useRouter();
  const [key] = useState(() => `refund-${crypto.randomUUID()}`);
  const [amount, setAmount] = useState(() =>
    request ? toDecimalString(deserialize(request.amount)) : '',
  );
  const [method, setMethod] = useState<'manual_bkash' | 'original' | 'store_credit'>(
    (request?.method as 'manual_bkash' | 'original' | 'store_credit' | undefined) ?? 'manual_bkash',
  );
  const [reason, setReason] = useState(request?.reason ?? '');
  const [providerRef, setProviderRef] = useState('');
  const gate = useMoneyGate(() => {
    toast.success('Refund recorded', 'The order totals are updated and the customer is told.');
    onClose();
    router.refresh();
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    gate.run(() =>
      refundOrderAction({
        orderId: order.id,
        ...(request ? { refundId: request.id } : { amount: amount.trim() }),
        method,
        reason: reason.trim() || 'Refund',
        ...(providerRef.trim() ? { providerRef: providerRef.trim() } : {}),
        idempotencyKey: key,
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{request ? 'Process refund request' : 'Record a refund'}</DialogTitle>
            <DialogDescription>
              Up to {money(order.refundable)} can still go back on {order.orderNumber}. Send the
              money first (for example by bKash), then record it here.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Amount (BDT)"
            required
            error={firstError(gate.errors, 'amount')}
            hint={request ? 'The amount of the request.' : 'A part of the order or all of it.'}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={amount}
                disabled={request !== null}
                maxLength={12}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="How it was sent" required error={firstError(gate.errors, 'method')}>
            {(control) => (
              <NativeSelect
                {...control}
                value={method}
                onChange={(event) => setMethod(event.target.value as typeof method)}
              >
                <option value="manual_bkash">Sent by bKash</option>
                <option value="original">Back to the original payment method</option>
                <option value="store_credit">Store credit (needs a customer account)</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Reason" required error={firstError(gate.errors, 'reason')}>
            {(control) => (
              <Input
                {...control}
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="bKash transaction id" hint="Optional. Kept with the refund.">
            {(control) => (
              <Input
                {...control}
                value={providerRef}
                maxLength={80}
                onChange={(e) => setProviderRef(e.target.value)}
              />
            )}
          </FormField>
          {gate.needsPassword ? (
            <FormField
              label="Your password"
              hint="Sending money back needs a fresh confirmation."
              required
            >
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  value={gate.password}
                  onChange={(event) => gate.setPassword(event.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {gate.error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={gate.pending}>
                Back
              </Button>
            </DialogClose>
            {gate.needsApproval && !gate.approvalSent ? (
              <Button
                type="button"
                variant="secondary"
                loading={gate.pending}
                onClick={() =>
                  gate.askForApproval({
                    orderId: order.id,
                    amount: request ? toDecimalString(deserialize(request.amount)) : amount.trim(),
                    reason: reason.trim() || 'Refund',
                  })
                }
              >
                Ask a manager to approve
              </Button>
            ) : null}
            <Button type="submit" loading={gate.pending}>
              Record refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
