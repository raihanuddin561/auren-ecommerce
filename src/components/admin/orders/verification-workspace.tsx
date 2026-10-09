'use client';

import { MessageCircle, Phone, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { failureMessage, fieldErrorsOf } from '@/components/admin/action-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/components/ui/price';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import {
  assignOrderAction,
  cancelOrderAction,
  claimOrderAction,
  confirmOrderAction,
  editOrderAction,
  holdOrderAction,
  releaseOrderAction,
} from '@/modules/orders/actions';
import {
  CANCEL_REASON_LABEL,
  CHANNEL_LABEL,
  CHECKLIST_ITEMS,
  ORDER_CANCEL_REASONS,
  VERIFICATION_CHANNELS,
  HOLD_OUTCOMES,
  type HoldOutcome,
  type OrderCancelReason,
  type VerificationChannelId,
  type VerificationChecklist,
} from '@/modules/orders/schemas';
import { minutesText } from '@/modules/orders/sla';
import type { Workspace } from '@/modules/orders/admin-types';
import { AddressFields, addressPayload, type AddressDraft, type AreaLists } from './address-fields';
import { LinesEditor, type LineDraft } from './lines-editor';
import { OrderStatusBadge } from './order-status-badge';

const OUTCOME_LABEL: Record<string, string> = {
  verified: 'Verified and confirmed',
  no_answer: 'No answer',
  busy: 'Line busy',
  wrong_number: 'Wrong number',
  callback_requested: 'Asked us to call back',
  customer_cancelled: 'Cancelled',
  suspected_fake: 'Suspected fake',
  order_edited: 'Order edited',
};
const HOLD_LABEL: Record<HoldOutcome, string> = {
  callback_requested: 'Customer asked for a call back',
  no_answer: 'No answer',
  busy: 'Line busy',
  wrong_number: 'Wrong number',
};
const CHANNEL_NAME: Record<VerificationChannelId, string> = {
  call: 'Phone call',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
};

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const money = (value: Parameters<typeof deserialize>[0]) => formatPrice(deserialize(value));

type Dialogs = 'hold' | 'cancel' | null;

export interface WorkspaceNavigation {
  /** Links to the neighbours in the queue (J and K). */
  previousHref: string | null;
  nextHref: string | null;
}

/**
 * The right half of the verification screen (DESIGN-SYSTEM 4.11): who the customer is, what they
 * ordered, the checklist that gates Confirm, ways to reach them, and the history of attempts. The
 * sticky footer holds the four outcomes. Keyboard: J and K move through the queue, C confirms
 * (when the checklist is complete), H puts the order on hold, X cancels.
 */
export function VerificationWorkspace({
  workspace,
  areas,
  assignable,
  viewer,
  navigation,
}: {
  workspace: Workspace;
  areas: AreaLists;
  assignable: Array<{ id: string; name: string }>;
  viewer: { staffId: string; manager: boolean; canEdit: boolean };
  navigation: WorkspaceNavigation;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState<VerificationChecklist>({
    genuine: false,
    items: false,
    address: false,
    payment: false,
    stock: false,
  });
  const [channel, setChannel] = useState<VerificationChannelId>('call');
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checklistRef = useRef<HTMLFieldSetElement>(null);

  const open = workspace.canEdit;
  const complete = Object.values(checklist).every(Boolean);
  const blocked = workspace.assignment.lockedByOther;

  const claimIfNeeded = useCallback(async () => {
    if (!open || workspace.assignment.mine || workspace.assignment.lockedByOther) return;
    try {
      const result = await claimOrderAction({ orderId: workspace.id });
      if (result.ok) router.refresh();
    } catch {
      // The action itself reports a lock; a failed background claim must not interrupt the work.
    }
  }, [open, router, workspace.assignment.lockedByOther, workspace.assignment.mine, workspace.id]);

  function toggle(key: keyof VerificationChecklist, value: boolean) {
    setChecklist((current) => ({ ...current, [key]: value }));
    setMessage(null);
    void claimIfNeeded();
  }

  const confirm = useCallback(() => {
    if (!complete) {
      setMessage('Tick every point of the checklist to confirm.');
      checklistRef.current?.querySelector<HTMLElement>('button[role="checkbox"]')?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const result = await confirmOrderAction({ orderId: workspace.id, checklist, channel });
        if (result.ok) {
          toast.success(
            `Order ${workspace.orderNumber} confirmed`,
            'It is now in the fulfilment queue.',
          );
          router.push(navigation.nextHref ?? '/admin/orders/verification');
          router.refresh();
        } else {
          setMessage(failureMessage(result));
        }
      } catch {
        setMessage('Something went wrong. Please try again.');
      }
    });
  }, [channel, checklist, complete, navigation, router, workspace.id, workspace.orderNumber]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      if (dialog !== null || editing) return;
      switch (event.key.toLowerCase()) {
        case 'j':
          if (navigation.nextHref) router.push(navigation.nextHref);
          break;
        case 'k':
          if (navigation.previousHref) router.push(navigation.previousHref);
          break;
        case 'c':
          if (open && !blocked && viewer.canEdit) confirm();
          break;
        case 'h':
          if (open && !blocked) {
            void claimIfNeeded();
            setDialog('hold');
          }
          break;
        case 'x':
          if (open && !blocked) {
            void claimIfNeeded();
            setDialog('cancel');
          }
          break;
        default:
          return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked, claimIfNeeded, confirm, dialog, editing, navigation, open, router, viewer.canEdit]);

  const address = workspace.address;
  const sla = workspace.sla;

  return (
    <div className="flex min-h-0 flex-col" aria-label={`Order ${workspace.orderNumber}`}>
      <div className="flex flex-col gap-6 pb-28">
        <header className="flex flex-wrap items-start justify-between gap-4 border border-line bg-raised p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="type-h3 text-fg">{workspace.orderNumber}</h2>
              <OrderStatusBadge status={workspace.status} />
              <Badge tone="outline">{CHANNEL_LABEL[workspace.channel] ?? workspace.channel}</Badge>
              {workspace.needsManagerReview ? <Badge tone="danger">Needs a manager</Badge> : null}
            </div>
            <p className="mt-1 type-admin text-fg-muted">
              Placed {dateTime.format(new Date(workspace.placedAt))}
              {workspace.createdByName ? ` · entered by ${workspace.createdByName}` : ''}
            </p>
            <p
              className={cn(
                'mt-1 type-admin',
                sla.overdue ? 'font-medium text-danger-text' : 'text-fg-muted',
              )}
            >
              {sla.overdue
                ? `Overdue by ${minutesText(sla.remainingMinutes)} of working time`
                : `${minutesText(sla.remainingMinutes)} left of the verification target`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 type-admin">
            {workspace.assignment.assigneeName ? (
              <span className="text-fg-muted">
                {workspace.assignment.mine
                  ? 'You are verifying this order'
                  : `With ${workspace.assignment.assigneeName}`}
                {workspace.assignment.claimExpiresAt
                  ? ` until ${new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(workspace.assignment.claimExpiresAt))}`
                  : ''}
              </span>
            ) : (
              <span className="text-fg-muted">Nobody has claimed it yet</span>
            )}
            {open && !blocked && !workspace.assignment.mine ? (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await claimOrderAction({ orderId: workspace.id });
                    if (result.ok) router.refresh();
                    else setMessage(failureMessage(result));
                  })
                }
              >
                Claim order
              </Button>
            ) : null}
            {workspace.assignment.mine && workspace.status === 'under_verification' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    const result = await releaseOrderAction({ orderId: workspace.id });
                    if (result.ok) router.refresh();
                    else setMessage(failureMessage(result));
                  })
                }
              >
                Release
              </Button>
            ) : null}
            {viewer.manager && open ? (
              <AssignMenu
                orderId={workspace.id}
                staff={assignable}
                current={workspace.assignment.assigneeId}
              />
            ) : null}
          </div>
        </header>

        {blocked ? (
          <p
            role="status"
            className="border border-warning bg-raised p-4 type-admin text-warning-text"
          >
            {workspace.assignment.assigneeName} is verifying this order. You can read it, but you
            cannot change it until their claim ends.
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <section aria-labelledby="customer-heading" className="border border-line bg-raised p-5">
            <h3 id="customer-heading" className="mb-3 type-eyebrow text-fg-muted">
              Customer
            </h3>
            <p className="type-body text-fg">{workspace.customer.name}</p>
            <p className="type-admin text-fg-muted">{workspace.customer.phone}</p>
            {workspace.customer.email ? (
              <p className="type-admin text-fg-muted">{workspace.customer.email}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={workspace.contact.telHref}>
                  <Icon icon={Phone} size={16} /> Call
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={workspace.contact.smsHref}>
                  <Icon icon={Smartphone} size={16} /> SMS
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={workspace.contact.whatsappHref} target="_blank" rel="noopener noreferrer">
                  <Icon icon={MessageCircle} size={16} /> WhatsApp
                </a>
              </Button>
            </div>
            <p className="mt-3 type-small text-fg-muted">{workspace.contact.message}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {workspace.risk.flags.map((flag) => (
                <Badge key={flag} tone="outline">
                  {flag.replaceAll('_', ' ')}
                </Badge>
              ))}
              {workspace.risk.onRecord.map((flag) => (
                <Badge key={`record-${flag}`} tone="danger">
                  {flag.replaceAll('_', ' ')} on record
                </Badge>
              ))}
              <Badge tone="neutral">Risk {workspace.risk.score} of 100</Badge>
            </div>
            {workspace.history.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 type-small text-fg-muted">Other orders from this number</p>
                <ul className="flex flex-col gap-1 type-small">
                  {workspace.history.map((past) => (
                    <li key={past.id} className="flex justify-between gap-3">
                      <Link
                        href={`/admin/orders/${past.id}`}
                        className="underline decoration-gold underline-offset-4"
                      >
                        {past.orderNumber}
                      </Link>
                      <span className="text-fg-muted capitalize">
                        {past.status.replaceAll('_', ' ')} · {money(past.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="address-heading" className="border border-line bg-raised p-5">
            <h3 id="address-heading" className="mb-3 type-eyebrow text-fg-muted">
              Delivery address
            </h3>
            <address className="type-admin text-fg not-italic">
              <span className="block">{address.fullName}</span>
              <span className="block">{address.line1}</span>
              {address.line2 ? <span className="block">{address.line2}</span> : null}
              <span className="block">
                {[address.area, address.thana.name].filter(Boolean).join(', ')}
              </span>
              <span className="block">
                {[address.district.name, address.division.name, address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </address>
            <p className="mt-3 type-small text-fg-muted">
              Serviceable: {workspace.delivery.zoneName}, {workspace.delivery.rateName},{' '}
              {workspace.delivery.minDays} to {workspace.delivery.maxDays} days
            </p>
            <p className="mt-1 type-small text-fg-muted">
              Payment: {workspace.paymentLabel} ({workspace.paymentStatus.replaceAll('_', ' ')})
            </p>
            {workspace.customerNote ? (
              <p className="mt-3 border-t border-line pt-3 type-admin text-fg">
                <span className="type-small text-fg-muted">Note from the customer: </span>
                {workspace.customerNote}
              </p>
            ) : null}
          </section>
        </div>

        <section aria-labelledby="items-heading" className="border border-line bg-raised">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h3 id="items-heading" className="type-h3 text-fg">
              Items
            </h3>
            {open && !blocked && viewer.canEdit && !editing ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void claimIfNeeded();
                  setEditing(true);
                }}
              >
                Edit order
              </Button>
            ) : null}
          </div>
          {editing ? (
            <EditPanel
              workspace={workspace}
              areas={areas}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse type-admin">
                  <caption className="sr-only">Items in this order</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left type-eyebrow text-fg-muted">
                        Item
                      </th>
                      <th scope="col" className="px-3 py-3 text-right type-eyebrow text-fg-muted">
                        Qty
                      </th>
                      <th scope="col" className="px-3 py-3 text-right type-eyebrow text-fg-muted">
                        In stock
                      </th>
                      <th scope="col" className="px-5 py-3 text-right type-eyebrow text-fg-muted">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.items.map((item) => (
                      <tr key={item.itemId} className="border-t border-line">
                        <td className="px-5 py-3">
                          <div className="text-fg">{item.title}</div>
                          <div className="type-small text-fg-muted">
                            {item.variantLabel} · {item.sku}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{item.available}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {money(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="flex flex-col gap-1 border-t border-line px-5 py-4 type-admin">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">Subtotal</dt>
                  <dd className="tabular-nums">{money(workspace.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">Delivery</dt>
                  <dd className="tabular-nums">
                    {workspace.delivery.free ? 'Complimentary' : money(workspace.shipping)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-2 type-body text-fg">
                  <dt>Total to collect</dt>
                  <dd className="tabular-nums">{money(workspace.total)}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        {open && viewer.canEdit ? (
          <fieldset
            ref={checklistRef}
            disabled={blocked}
            className="border border-line bg-raised p-5"
          >
            <legend className="px-2 type-eyebrow text-fg-muted">
              Verification checklist (every point is required to confirm)
            </legend>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {CHECKLIST_ITEMS.map((item) => (
                <Checkbox
                  key={item.key}
                  label={item.label}
                  checked={checklist[item.key]}
                  onCheckedChange={(value) => toggle(item.key, value === true)}
                />
              ))}
            </div>
            <div className="mt-3 max-w-xs">
              <FormField label="How did you reach the customer?">
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="h-10"
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as VerificationChannelId)}
                  >
                    {VERIFICATION_CHANNELS.map((id) => (
                      <option key={id} value={id}>
                        {CHANNEL_NAME[id]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>
          </fieldset>
        ) : null}

        <section aria-labelledby="attempts-heading" className="border border-line bg-raised p-5">
          <h3 id="attempts-heading" className="mb-3 type-eyebrow text-fg-muted">
            Attempt history ({workspace.attemptCount} on hold)
          </h3>
          {workspace.attempts.length === 0 ? (
            <p className="type-admin text-fg-muted">No contact attempts logged yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {workspace.attempts.map((attempt) => (
                <li key={`${attempt.at}-${attempt.outcome}`} className="type-admin">
                  <span className="text-fg">
                    {OUTCOME_LABEL[attempt.outcome] ?? attempt.outcome}
                  </span>{' '}
                  <span className="text-fg-muted">
                    · {attempt.staffName} · {attempt.channel} ·{' '}
                    {dateTime.format(new Date(attempt.at))}
                  </span>
                  {attempt.note ? <p className="type-small text-fg-muted">{attempt.note}</p> : null}
                  {attempt.nextAttemptAt ? (
                    <p className="type-small text-fg-muted">
                      Try again {dateTime.format(new Date(attempt.nextAttemptAt))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {open && viewer.canEdit ? (
        <div className="sticky bottom-0 -mx-1 mt-auto border-t border-line bg-page/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-page/80">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              loading={pending}
              disabled={blocked || !complete}
              onClick={confirm}
              aria-keyshortcuts="C"
            >
              Confirm order
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={blocked || pending}
              onClick={() => {
                void claimIfNeeded();
                setDialog('hold');
              }}
              aria-keyshortcuts="H"
            >
              Call back later
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={blocked || pending}
              onClick={() => {
                void claimIfNeeded();
                setDialog('cancel');
              }}
              aria-keyshortcuts="X"
            >
              Cancel order
            </Button>
            <span role="status" className="min-h-5 type-small text-fg-muted">
              {message ??
                (complete
                  ? 'Checklist complete. Press C to confirm.'
                  : `${Object.values(checklist).filter(Boolean).length} of ${CHECKLIST_ITEMS.length} checklist points ticked.`)}
            </span>
          </div>
          <p className="mt-1 hidden type-small text-fg-muted md:block">
            Keys: J next order, K previous order, C confirm, H call back later, X cancel.
          </p>
        </div>
      ) : null}

      <HoldDialog
        open={dialog === 'hold'}
        onClose={() => setDialog(null)}
        orderId={workspace.id}
        defaultChannel={channel}
        onDone={() => {
          setDialog(null);
          router.push(navigation.nextHref ?? '/admin/orders/verification');
          router.refresh();
        }}
      />
      <CancelDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        orderId={workspace.id}
        orderNumber={workspace.orderNumber}
        paid={workspace.paymentStatus === 'paid'}
        onDone={() => {
          setDialog(null);
          router.push(navigation.nextHref ?? '/admin/orders/verification');
          router.refresh();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function AssignMenu({
  orderId,
  staff,
  current,
}: {
  orderId: string;
  staff: Array<{ id: string; name: string }>;
  current: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 type-small text-fg-muted">
      Assign to
      <NativeSelect
        className="h-10 w-48"
        value={current ?? ''}
        disabled={pending}
        onChange={(event) => {
          const assigneeId = event.target.value;
          if (!assigneeId) return;
          startTransition(async () => {
            const result = await assignOrderAction({ orderId, assigneeId });
            if (result.ok) {
              toast.success('Order assigned');
              router.refresh();
            } else {
              toast.error('Could not assign', failureMessage(result) ?? undefined);
            }
          });
        }}
      >
        <option value="">Choose a person</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function HoldDialog({
  open,
  onClose,
  orderId,
  defaultChannel,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  defaultChannel: VerificationChannelId;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<HoldOutcome>('callback_requested');
  const [channel, setChannel] = useState<VerificationChannelId>(defaultChannel);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await holdOrderAction({
          orderId,
          outcome,
          channel,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(when ? { nextAttemptAt: new Date(when).toISOString() } : {}),
        });
        if (result.ok) {
          toast.message('Call back logged', 'The order is on hold until the next attempt.');
          onDone();
        } else {
          setError(failureMessage(result) ?? fieldErrorsOf(result).nextAttemptAt?.[0] ?? null);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Call back later</DialogTitle>
            <DialogDescription>
              Logs the attempt and puts the order on hold. It stays in the queue and is never
              cancelled automatically.
            </DialogDescription>
          </DialogHeader>
          <FormField label="What happened" required>
            {(control) => (
              <NativeSelect
                {...control}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as HoldOutcome)}
              >
                {HOLD_OUTCOMES.map((id) => (
                  <option key={id} value={id}>
                    {HOLD_LABEL[id]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label="How you tried">
            {(control) => (
              <NativeSelect
                {...control}
                value={channel}
                onChange={(event) => setChannel(event.target.value as VerificationChannelId)}
              >
                {VERIFICATION_CHANNELS.map((id) => (
                  <option key={id} value={id}>
                    {CHANNEL_NAME[id]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            label="Try again at"
            hint="Optional. A reminder shows in the queue when it is due."
          >
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Note">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Save and hold
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onClose,
  orderId,
  orderNumber,
  paid,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  paid: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<OrderCancelReason>('customer_cancelled');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelOrderAction({
          orderId,
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (result.ok) {
          toast.warning(`Order ${orderNumber} cancelled`, 'The stock is back on the shelf.');
          onDone();
        } else {
          setError(failureMessage(result));
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Cancel order {orderNumber}</DialogTitle>
            <DialogDescription>
              The stock goes back on the shelf.
              {paid
                ? ' The order was paid, so a refund request is created for a manager to process.'
                : ''}{' '}
              A reason is required.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Reason" required>
            {(control) => (
              <NativeSelect
                {...control}
                value={reason}
                onChange={(event) => setReason(event.target.value as OrderCancelReason)}
              >
                {ORDER_CANCEL_REASONS.map((id) => (
                  <option key={id} value={id}>
                    {CANCEL_REASON_LABEL[id]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Note" required={reason === 'other'}>
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Keep the order
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" loading={pending}>
              Cancel order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPanel({
  workspace,
  areas,
  onDone,
}: {
  workspace: Workspace;
  areas: AreaLists;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<LineDraft[]>(() =>
    workspace.items.map((item) => ({
      key: item.itemId,
      itemId: item.itemId,
      variantId: item.variantId,
      title: item.title,
      label: item.variantLabel,
      sku: item.sku,
      quantity: String(item.quantity),
      price: item.unitPrice,
      available: item.available,
      alternatives: item.alternatives,
    })),
  );
  const [changeAddress, setChangeAddress] = useState(false);
  const [address, setAddress] = useState<AddressDraft>(() => ({
    divisionId: areas.divisions.find((d) => d.name === workspace.address.division.name)?.id ?? '',
    districtId: areas.districts.find((d) => d.name === workspace.address.district.name)?.id ?? '',
    thanaId: '',
    thanaName: workspace.address.thana.name,
    area: workspace.address.area,
    line1: workspace.address.line1,
    line2: workspace.address.line2 ?? '',
    postalCode: workspace.address.postalCode ?? '',
  }));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function save() {
    setErrors({});
    setError(null);
    const quantities = lines.map((line) => Number(line.quantity));
    if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1)) {
      setErrors({ lines: ['Every quantity must be a whole number of at least 1.'] });
      return;
    }
    startTransition(async () => {
      try {
        const result = await editOrderAction({
          orderId: workspace.id,
          lines: lines.map((line, index) => ({
            ...(line.itemId ? { itemId: line.itemId } : {}),
            variantId: line.variantId,
            quantity: quantities[index]!,
          })),
          ...(changeAddress ? { address: addressPayload(address, areas) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (result.ok) {
          toast.success(
            'Order updated',
            result.data.totalChanged
              ? 'The total changed. The customer is told, and prices were set again by the server.'
              : 'Saved.',
          );
          onDone();
        } else {
          setErrors(fieldErrorsOf(result));
          setError(failureMessage(result));
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <LinesEditor lines={lines} onChange={setLines} error={errors.lines?.[0] ?? null} />
      <div>
        <Checkbox
          label="Fix the delivery address"
          checked={changeAddress}
          onCheckedChange={(value) => setChangeAddress(value === true)}
        />
        {changeAddress ? (
          <div className="mt-3">
            <AddressFields value={address} onChange={setAddress} areas={areas} errors={errors} />
          </div>
        ) : null}
      </div>
      <FormField
        label="Note for the timeline"
        hint="Optional. For example what the customer asked for."
      >
        {(control) => (
          <Input
            {...control}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </FormField>
      <p role="alert" className="min-h-5 type-small text-danger-text">
        {error}
      </p>
      <div className="flex gap-3">
        <Button type="button" loading={pending} onClick={save}>
          Save changes
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onDone}>
          Discard
        </Button>
      </div>
    </div>
  );
}
