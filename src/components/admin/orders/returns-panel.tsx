'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import type { ActionResult } from '@/lib/action-result';
import { deserialize, toDecimalString, type SerializedMoney } from '@/lib/money';
import {
  approveReturnAction,
  closeReturnAction,
  inspectReturnAction,
  receiveReturnAction,
  rejectReturnAction,
  resolveReturnAction,
  shipReplacementAction,
} from '@/modules/returns/actions';
import { RETURN_REASON_LABEL, RETURN_STATUS_LABEL } from '@/modules/returns/schemas';
import type { AdminOrderDetail, DetailReturn } from '@/modules/orders/admin-types';
import { useMoneyGate } from './use-money-gate';

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });
const money = (value: SerializedMoney) => formatPrice(deserialize(value));

type Step =
  | { kind: 'reject' | 'receive' | 'inspect' | 'resolve' | 'close'; target: DetailReturn }
  | { kind: 'replacement' }
  | null;

/**
 * Returns and exchanges on the order page (6.12): approve or reject, receive, inspect each item
 * (resellable goes back on the shelf, damaged is written off), then refund, store credit or an
 * exchange for another size. Customers ask from their own order page.
 */
export function ReturnsPanel({
  order,
  canManage,
  canRefund,
  canShip,
}: {
  order: Pick<
    AdminOrderDetail,
    'id' | 'orderNumber' | 'returns' | 'returnWindow' | 'pendingReplacements' | 'status'
  >;
  canManage: boolean;
  canRefund: boolean;
  canShip: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(null);

  function approve(target: DetailReturn) {
    startTransition(async () => {
      const result = await approveReturnAction({ returnId: target.id });
      if (result.ok) {
        toast.success(`${target.returnNumber} approved`, 'The customer is told.');
        router.refresh();
      } else {
        toast.error('Could not approve', failureMessage(result) ?? undefined);
      }
    });
  }

  if (order.returns.length === 0 && order.status !== 'delivered') return null;

  return (
    <section aria-labelledby="returns-heading" className="border border-line bg-raised p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="returns-heading" className="type-h3 text-fg">
          Returns and exchanges
        </h2>
        {order.pendingReplacements > 0 && canShip && canManage ? (
          <Button size="sm" onClick={() => setStep({ kind: 'replacement' })}>
            Send the replacement
          </Button>
        ) : null}
      </div>
      {order.returns.length === 0 ? (
        <p className="type-admin text-fg-muted">
          {order.returnWindow.open
            ? `The customer can ask for a return or exchange from their order page until ${dateTime.format(new Date(order.returnWindow.endsAt!))}.`
            : 'No returns on this order.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {order.returns.map((found) => (
            <li key={found.id} className="border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-admin font-medium text-fg">
                  {found.returnNumber}{' '}
                  <span className="font-normal text-fg-muted capitalize">
                    ({found.type}, {dateTime.format(new Date(found.createdAt))})
                  </span>
                </p>
                <Badge tone={found.status === 'rejected' ? 'neutral' : 'outline'}>
                  {RETURN_STATUS_LABEL[found.status] ?? found.status}
                </Badge>
              </div>
              <ul className="mt-2 flex flex-col gap-1 type-small text-fg-muted">
                {found.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} x {item.title} ({item.variantLabel}):{' '}
                    {RETURN_REASON_LABEL[item.reason as keyof typeof RETURN_REASON_LABEL] ??
                      item.reason}
                    {item.condition ? ` · ${item.condition}` : ''}
                    {item.exchangeVariantLabel ? ` · ${item.exchangeVariantLabel}` : ''}
                  </li>
                ))}
              </ul>
              {found.customerNote ? (
                <p className="mt-2 type-small text-fg">
                  <span className="text-fg-muted">Customer: </span>
                  {found.customerNote}
                </p>
              ) : null}
              {found.staffNote ? (
                <p className="mt-1 type-small text-fg">
                  <span className="text-fg-muted">Team: </span>
                  {found.staffNote}
                </p>
              ) : null}
              <p className="mt-2 type-small text-fg-muted">
                Value of the returned items {money(found.value)}
                {found.returnShipping && BigInt(found.returnShipping.minor) > 0n
                  ? ` · return shipping ${money(found.returnShipping)}`
                  : ''}
              </p>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {found.status === 'requested' ? (
                    <>
                      <Button size="sm" loading={pending} onClick={() => approve(found)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setStep({ kind: 'reject', target: found })}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {found.status === 'approved' || found.status === 'in_transit' ? (
                    <>
                      <Button size="sm" onClick={() => setStep({ kind: 'receive', target: found })}>
                        Mark received
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStep({ kind: 'reject', target: found })}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {found.status === 'received' ? (
                    <Button size="sm" onClick={() => setStep({ kind: 'inspect', target: found })}>
                      Inspect the items
                    </Button>
                  ) : null}
                  {found.status === 'inspected' ? (
                    <>
                      <Button size="sm" onClick={() => setStep({ kind: 'resolve', target: found })}>
                        {found.type === 'exchange' ? 'Complete the exchange' : 'Settle the return'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStep({ kind: 'close', target: found })}
                      >
                        Close without a refund
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {step && step.kind !== 'replacement' ? (
        <>
          <TextStepDialog
            open={step.kind === 'reject' || step.kind === 'close'}
            onClose={() => setStep(null)}
            title={
              step.kind === 'close'
                ? `Close ${step.target.returnNumber}`
                : `Reject ${step.target.returnNumber}`
            }
            description={
              step.kind === 'close'
                ? 'Nothing is refunded and no replacement is sent. The note is kept for the team.'
                : 'The customer is told. Say why, kindly and plainly.'
            }
            label={step.kind === 'close' ? 'Note' : 'Reason'}
            submitLabel={step.kind === 'close' ? 'Close return' : 'Reject return'}
            danger={step.kind === 'reject'}
            run={(text) =>
              step.kind === 'close'
                ? closeReturnAction({ returnId: step.target.id, note: text })
                : rejectReturnAction({ returnId: step.target.id, reason: text })
            }
          />
          <ReceiveDialog
            open={step.kind === 'receive'}
            onClose={() => setStep(null)}
            target={step.target}
          />
          <InspectDialog
            open={step.kind === 'inspect'}
            onClose={() => setStep(null)}
            target={step.target}
          />
          <ResolveDialog
            open={step.kind === 'resolve'}
            onClose={() => setStep(null)}
            orderId={order.id}
            target={step.target}
            canRefund={canRefund}
          />
        </>
      ) : null}
      <ReplacementDialog
        open={step?.kind === 'replacement'}
        onClose={() => setStep(null)}
        orderId={order.id}
      />
    </section>
  );
}

function useStepForm(onClose: () => void, success: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  return {
    pending,
    errors,
    error,
    run(work: () => Promise<ActionResult<unknown>>) {
      setError(null);
      setErrors({});
      startTransition(async () => {
        try {
          const result = await work();
          if (result.ok) {
            toast.success(success);
            onClose();
            router.refresh();
          } else {
            setErrors(result.error.fieldErrors ?? {});
            setError(failureMessage(result));
          }
        } catch {
          setError('Something went wrong. Please try again.');
        }
      });
    },
  };
}

function Shell({
  open,
  onClose,
  title,
  description,
  onSubmit,
  children,
  error,
  pending,
  submitLabel,
  danger,
  extraFooter,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
  error: string | null;
  pending: boolean;
  submitLabel: string;
  danger?: boolean;
  extraFooter?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Back
              </Button>
            </DialogClose>
            {extraFooter}
            <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextStepDialog({
  open,
  onClose,
  title,
  description,
  label,
  submitLabel,
  danger,
  run,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  danger?: boolean;
  run: (text: string) => Promise<ActionResult<unknown>>;
}) {
  const form = useStepForm(onClose, 'Saved.');
  const [text, setText] = useState('');
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      error={form.error}
      pending={form.pending}
      submitLabel={submitLabel}
      {...(danger ? { danger } : {})}
      onSubmit={(event) => {
        event.preventDefault();
        form.run(() => run(text.trim()));
      }}
    >
      <FormField
        label={label}
        required
        error={form.errors.reason?.[0] ?? form.errors.note?.[0] ?? null}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </FormField>
    </Shell>
  );
}

function ReceiveDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: DetailReturn;
}) {
  const form = useStepForm(onClose, 'Return received.');
  const [cost, setCost] = useState('');
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={`Receive ${target.returnNumber}`}
      description="The parcel has arrived. What it cost us to bring it back is added to this order's costs."
      error={form.error}
      pending={form.pending}
      submitLabel="Mark received"
      onSubmit={(event) => {
        event.preventDefault();
        form.run(() =>
          receiveReturnAction({
            returnId: target.id,
            ...(cost.trim() ? { shippingCost: cost.trim() } : {}),
          }),
        );
      }}
    >
      <FormField
        label="Return shipping cost (BDT)"
        hint="Optional."
        error={firstError(form.errors, 'shippingCost')}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={cost}
            maxLength={12}
            onChange={(e) => setCost(e.target.value)}
          />
        )}
      </FormField>
    </Shell>
  );
}

function InspectDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: DetailReturn;
}) {
  const form = useStepForm(onClose, 'Inspection saved. Stock is updated.');
  const [conditions, setConditions] = useState<Record<string, 'resellable' | 'damaged'>>(() =>
    Object.fromEntries(target.items.map((item) => [item.id, 'resellable'])),
  );
  const [note, setNote] = useState('');
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={`Inspect ${target.returnNumber}`}
      description="Goods that can be sold go back on the shelf. Damaged goods come back into the ledger and are written off straight away."
      error={form.error}
      pending={form.pending}
      submitLabel="Save inspection"
      onSubmit={(event) => {
        event.preventDefault();
        form.run(() =>
          inspectReturnAction({
            returnId: target.id,
            conditions: target.items.map((item) => ({
              returnItemId: item.id,
              condition: conditions[item.id] ?? 'resellable',
            })),
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        );
      }}
    >
      {target.items.map((item) => (
        <FormField key={item.id} label={`${item.quantity} x ${item.title} (${item.variantLabel})`}>
          {(control) => (
            <NativeSelect
              {...control}
              value={conditions[item.id] ?? 'resellable'}
              onChange={(e) =>
                setConditions((current) => ({
                  ...current,
                  [item.id]: e.target.value as 'resellable' | 'damaged',
                }))
              }
            >
              <option value="resellable">Fit to sell again</option>
              <option value="damaged">Damaged: write off</option>
            </NativeSelect>
          )}
        </FormField>
      ))}
      <FormField label="Note">
        {(control) => (
          <Input
            {...control}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </FormField>
    </Shell>
  );
}

function ResolveDialog({
  open,
  onClose,
  orderId,
  target,
  canRefund,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  target: DetailReturn;
  canRefund: boolean;
}) {
  const router = useRouter();
  const exchange = target.type === 'exchange';
  const [key] = useState(() => `return-${crypto.randomUUID()}`);
  const [resolution, setResolution] = useState<'refund' | 'store_credit' | 'exchange'>(
    exchange ? 'exchange' : 'refund',
  );
  const [amount, setAmount] = useState(() => toDecimalString(deserialize(target.value)));
  const [method, setMethod] = useState<'manual_bkash' | 'original'>('manual_bkash');
  const [providerRef, setProviderRef] = useState('');
  const gate = useMoneyGate(() => {
    toast.success('Return settled', 'The customer is told.');
    onClose();
    router.refresh();
  });
  const needsMoney = resolution !== 'exchange';

  return (
    <Shell
      open={open}
      onClose={onClose}
      title={`Settle ${target.returnNumber}`}
      description={
        exchange
          ? 'The replacement leaves stock now and is recorded at no extra charge. Send it from the order page afterwards.'
          : `The returned items were sold for ${money(target.value)}. A refund goes through the usual controls.`
      }
      error={gate.error}
      pending={gate.pending}
      submitLabel={exchange ? 'Complete exchange' : 'Settle return'}
      extraFooter={
        gate.needsApproval && !gate.approvalSent ? (
          <Button
            type="button"
            variant="secondary"
            loading={gate.pending}
            onClick={() =>
              gate.askForApproval({
                orderId,
                amount: amount.trim(),
                reason: `Return ${target.returnNumber}`,
              })
            }
          >
            Ask a manager to approve
          </Button>
        ) : null
      }
      onSubmit={(event) => {
        event.preventDefault();
        gate.run(() =>
          resolveReturnAction({
            returnId: target.id,
            resolution,
            ...(needsMoney ? { amount: amount.trim() } : {}),
            ...(resolution === 'refund' ? { refundMethod: method } : {}),
            ...(providerRef.trim() ? { providerRef: providerRef.trim() } : {}),
            idempotencyKey: key,
          }),
        );
      }}
    >
      {exchange ? null : (
        <FormField label="How to settle" required>
          {(control) => (
            <NativeSelect
              {...control}
              value={resolution}
              onChange={(e) => setResolution(e.target.value as 'refund' | 'store_credit')}
            >
              <option value="refund" disabled={!canRefund}>
                Refund the money{canRefund ? '' : ' (you need refund rights)'}
              </option>
              <option value="store_credit" disabled={!canRefund}>
                Store credit{canRefund ? '' : ' (you need refund rights)'}
              </option>
            </NativeSelect>
          )}
        </FormField>
      )}
      {needsMoney ? (
        <>
          <FormField label="Amount (BDT)" required error={firstError(gate.errors, 'amount')}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={amount}
                maxLength={12}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
          {resolution === 'refund' ? (
            <FormField label="How it was sent">
              {(control) => (
                <NativeSelect
                  {...control}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  <option value="manual_bkash">Sent by bKash</option>
                  <option value="original">Back to the original payment method</option>
                </NativeSelect>
              )}
            </FormField>
          ) : null}
          <FormField label="bKash transaction id" hint="Optional.">
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
                  onChange={(e) => gate.setPassword(e.target.value)}
                />
              )}
            </FormField>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

function ReplacementDialog({
  open,
  onClose,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const form = useStepForm(onClose, 'Replacement recorded. The customer is told.');
  const [name, setName] = useState('');
  const [tracking, setTracking] = useState('');
  const [cost, setCost] = useState('');
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Send the replacement"
      description="Record who carries the replacement parcel and what it costs."
      error={form.error}
      pending={form.pending}
      submitLabel="Record parcel"
      onSubmit={(event) => {
        event.preventDefault();
        form.run(() =>
          shipReplacementAction({
            orderId,
            courierName: name.trim(),
            trackingNumber: tracking.trim(),
            ...(cost.trim() ? { cost: cost.trim() } : {}),
          }),
        );
      }}
    >
      <FormField
        label="Courier or rider name"
        required
        error={firstError(form.errors, 'courierName')}
      >
        {(control) => (
          <Input
            {...control}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Tracking number" required error={firstError(form.errors, 'trackingNumber')}>
        {(control) => (
          <Input
            {...control}
            value={tracking}
            maxLength={80}
            onChange={(e) => setTracking(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Courier charge (BDT)" error={firstError(form.errors, 'cost')}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={cost}
            maxLength={12}
            onChange={(e) => setCost(e.target.value)}
          />
        )}
      </FormField>
    </Shell>
  );
}
