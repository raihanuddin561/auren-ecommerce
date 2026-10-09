'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage, fieldErrorsOf, firstError } from '@/components/admin/action-feedback';
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
import { deserialize, type SerializedMoney } from '@/lib/money';
import {
  receiveReturnToOriginAction,
  shipOrderAction,
  startProcessingAction,
  updateParcelDetailsAction,
  updateParcelStatusAction,
} from '@/modules/orders/fulfilment-actions';
import type { AdminOrderDetail } from '@/modules/orders/admin-types';
import type { OrderStatus } from '@/modules/orders/timeline';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const money = (value: SerializedMoney) => formatPrice(deserialize(value));

const PARCEL_LABEL: Record<string, string> = {
  pending: 'Not booked',
  booked: 'Booked',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Delivery failed',
  returned: 'Returned to us',
};

const STATUS_CHOICES = [
  ['picked_up', 'Picked up by the courier'],
  ['in_transit', 'In transit'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered and cash collected'],
  ['failed', 'Delivery failed'],
] as const;

type Dialogs = 'ship' | 'status' | 'rto' | 'details' | null;

/**
 * Fulfilment on the order page: start picking, hand the parcel to a courier (or type a manual
 * courier's tracking number), report where it is, record a parcel that came back. Every button maps to
 * one server action that checks the order's state and the staff member's permission again.
 */
export function FulfilmentPanel({
  order,
  canFulfil,
  canShip,
  canSeeCost,
}: {
  order: Pick<
    AdminOrderDetail,
    'id' | 'status' | 'shipments' | 'couriers' | 'packaging' | 'orderNumber' | 'total'
  >;
  canFulfil: boolean;
  canShip: boolean;
  canSeeCost: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const status = order.status as OrderStatus;
  const live = order.shipments.find(
    (shipment) => shipment.kind === 'outbound' && !['failed', 'returned'].includes(shipment.status),
  );
  const latest = [...order.shipments].reverse().find((shipment) => shipment.kind === 'outbound');
  const canBook = ['confirmed', 'processing', 'delivery_failed'].includes(status) && !live;
  const parcel = order.shipments.find((shipment) => shipment.id === selected) ?? live ?? latest;

  function startPicking() {
    startTransition(async () => {
      const result = await startProcessingAction({ orderId: order.id });
      if (result.ok) {
        toast.success('Picking started');
        router.refresh();
      } else {
        toast.error('Could not start picking', failureMessage(result) ?? undefined);
      }
    });
  }

  return (
    <section aria-labelledby="fulfilment-heading" className="border border-line bg-raised p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="fulfilment-heading" className="type-h3 text-fg">
          Fulfilment
        </h2>
        {canFulfil ? (
          <div className="flex flex-wrap gap-2">
            {status === 'confirmed' ? (
              <Button size="sm" variant="secondary" loading={pending} onClick={startPicking}>
                Start picking
              </Button>
            ) : null}
            {canBook && canShip ? (
              <Button size="sm" onClick={() => setDialog('ship')}>
                {status === 'delivery_failed' ? 'Book again' : 'Book parcel'}
              </Button>
            ) : null}
            {status === 'shipped' && live ? (
              <Button
                size="sm"
                onClick={() => {
                  setSelected(live.id);
                  setDialog('status');
                }}
              >
                Update parcel status
              </Button>
            ) : null}
            {(status === 'shipped' || status === 'delivery_failed') && canShip ? (
              <Button size="sm" variant="secondary" onClick={() => setDialog('rto')}>
                Parcel is back with us
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {status === 'placed' || status === 'under_verification' || status === 'on_hold' ? (
        <p className="type-admin text-fg-muted">
          Nothing can be prepared until a team member has verified and confirmed this order.
        </p>
      ) : null}
      {order.shipments.length === 0 &&
      status !== 'placed' &&
      status !== 'under_verification' &&
      status !== 'on_hold' ? (
        <p className="type-admin text-fg-muted">
          {status === 'cancelled'
            ? 'This order was cancelled before it shipped.'
            : 'No parcel has been booked yet.'}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {order.shipments.map((shipment) => (
          <li key={shipment.id} className="border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-admin text-fg">
                {shipment.kind === 'replacement' ? 'Replacement: ' : ''}
                {shipment.courierName ?? shipment.courierLabel}
                {shipment.trackingNumber ? (
                  <span className="ml-2 font-mono text-fg-muted">{shipment.trackingNumber}</span>
                ) : null}
              </p>
              <Badge
                tone={
                  shipment.status === 'delivered'
                    ? 'success'
                    : shipment.status === 'failed'
                      ? 'danger'
                      : 'outline'
                }
              >
                {PARCEL_LABEL[shipment.status] ?? shipment.status}
              </Badge>
            </div>
            <p className="mt-1 type-small text-fg-muted">
              Cash to collect {money(shipment.codAmount)}
              {shipment.cost ? ` · courier charge ${money(shipment.cost)}` : ''}
              {shipment.codFee && BigInt(shipment.codFee.minor) > 0n
                ? ` · collection fee ${money(shipment.codFee)}`
                : ''}
            </p>
            {shipment.events.length > 0 ? (
              <ol className="mt-3 flex flex-col gap-1 type-small text-fg-muted">
                {shipment.events.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    {dateTime.format(new Date(event.at))} ·{' '}
                    {PARCEL_LABEL[event.status] ?? event.status}
                    {event.description ? `: ${event.description}` : ''}
                  </li>
                ))}
              </ol>
            ) : null}
            {canShip && shipment.kind === 'outbound' && shipment.status !== 'returned' ? (
              <Button
                className="mt-3"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(shipment.id);
                  setDialog('details');
                }}
              >
                Edit tracking or charges
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <ShipDialog
        open={dialog === 'ship'}
        onClose={() => setDialog(null)}
        order={order}
        canSeeCost={canSeeCost}
      />
      {parcel ? (
        <>
          <StatusDialog
            open={dialog === 'status'}
            onClose={() => setDialog(null)}
            orderId={order.id}
            shipmentId={parcel.id}
          />
          <DetailsDialog
            open={dialog === 'details'}
            onClose={() => setDialog(null)}
            orderId={order.id}
            shipment={parcel}
            canSeeCost={canSeeCost}
          />
        </>
      ) : null}
      <RtoDialog open={dialog === 'rto'} onClose={() => setDialog(null)} orderId={order.id} />
    </section>
  );
}

function useDialogForm(onClose: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  return {
    pending,
    errors,
    error,
    run(work: () => Promise<ActionResult<unknown>>, success: string) {
      setErrors({});
      setError(null);
      startTransition(async () => {
        try {
          const result = await work();
          if (result.ok) {
            toast.success(success);
            onClose();
            router.refresh();
          } else {
            setErrors(fieldErrorsOf(result));
            setError(failureMessage(result));
          }
        } catch {
          setError('Something went wrong. Please try again.');
        }
      });
    },
  };
}

function ShipDialog({
  open,
  onClose,
  order,
  canSeeCost,
}: {
  open: boolean;
  onClose: () => void;
  order: Pick<AdminOrderDetail, 'id' | 'orderNumber' | 'total' | 'couriers' | 'packaging'>;
  canSeeCost: boolean;
}) {
  const form = useDialogForm(onClose);
  const [courier, setCourier] = useState<string>('manual');
  const [courierName, setCourierName] = useState('');
  const [tracking, setTracking] = useState('');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const [packagingId, setPackagingId] = useState('');
  const manual = courier === 'manual';

  function submit(event: FormEvent) {
    event.preventDefault();
    form.run(
      () =>
        shipOrderAction({
          orderId: order.id,
          courier,
          ...(manual ? { courierName: courierName.trim(), trackingNumber: tracking.trim() } : {}),
          ...(cost.trim() ? { cost: cost.trim() } : {}),
          ...(weight.trim() ? { weightG: Number(weight) } : {}),
          ...(packagingId ? { packagingProfileId: packagingId } : {}),
        }),
      'Parcel booked. The customer is told.',
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Book parcel for {order.orderNumber}</DialogTitle>
            <DialogDescription>
              The customer pays {money(order.total)} in cash on delivery. Booking moves the order to
              shipped and tells the customer.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Courier" required error={firstError(form.errors, 'courier')}>
            {(control) => (
              <NativeSelect
                {...control}
                value={courier}
                onChange={(event) => setCourier(event.target.value)}
              >
                {order.couriers.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {manual ? (
            <>
              <FormField
                label="Courier or rider name"
                required
                error={firstError(form.errors, 'courierName')}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={courierName}
                    maxLength={80}
                    onChange={(e) => setCourierName(e.target.value)}
                  />
                )}
              </FormField>
              <FormField
                label="Tracking number"
                required
                error={firstError(form.errors, 'trackingNumber')}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={tracking}
                    maxLength={80}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                )}
              </FormField>
            </>
          ) : (
            <p className="type-small text-fg-muted">
              The courier books the parcel and returns the tracking number.
            </p>
          )}
          {canSeeCost ? (
            <FormField
              label="Courier charge (BDT)"
              hint={
                manual
                  ? 'What the courier charges us. It joins the order costs.'
                  : 'Used when the courier does not return its charge.'
              }
              error={firstError(form.errors, 'cost')}
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
          ) : null}
          <FormField label="Weight in grams" error={firstError(form.errors, 'weightG')}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={weight}
                maxLength={6}
                onChange={(e) => setWeight(e.target.value)}
              />
            )}
          </FormField>
          {order.packaging.length > 0 ? (
            <FormField label="Packaging" hint="Its cost is added to this order.">
              {(control) => (
                <NativeSelect
                  {...control}
                  value={packagingId}
                  onChange={(e) => setPackagingId(e.target.value)}
                >
                  <option value="">Default profile</option>
                  {order.packaging.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({money(profile.cost)})
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ) : null}
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {form.error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={form.pending}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" loading={form.pending}>
              Book parcel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({
  open,
  onClose,
  orderId,
  shipmentId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  shipmentId: string;
}) {
  const form = useDialogForm(onClose);
  const [status, setStatus] = useState<string>('delivered');
  const [note, setNote] = useState('');
  const [codFee, setCodFee] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    form.run(
      () =>
        updateParcelStatusAction({
          orderId,
          shipmentId,
          status,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(status === 'delivered' && codFee.trim() ? { codFee: codFee.trim() } : {}),
        }),
      status === 'delivered' ? 'Delivered. The cash is recorded as collected.' : 'Parcel updated.',
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Where is the parcel</DialogTitle>
            <DialogDescription>
              Delivered records the cash on delivery payment and counts the sale. A failed delivery
              lets you book again or take the parcel back.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Status" required>
            {(control) => (
              <NativeSelect {...control} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_CHOICES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {status === 'delivered' ? (
            <FormField
              label="Courier collection fee (BDT)"
              hint="What the courier keeps for collecting the cash. Optional."
              error={firstError(form.errors, 'codFee')}
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="decimal"
                  value={codFee}
                  maxLength={12}
                  onChange={(e) => setCodFee(e.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <FormField label="Note">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </FormField>
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {form.error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={form.pending}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" loading={form.pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailsDialog({
  open,
  onClose,
  orderId,
  shipment,
  canSeeCost,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  shipment: AdminOrderDetail['shipments'][number];
  canSeeCost: boolean;
}) {
  const form = useDialogForm(onClose);
  const [name, setName] = useState(shipment.courierName ?? '');
  const [tracking, setTracking] = useState(shipment.trackingNumber ?? '');
  const [cost, setCost] = useState('');
  const [fee, setFee] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    form.run(
      () =>
        updateParcelDetailsAction({
          orderId,
          shipmentId: shipment.id,
          ...(shipment.courier === 'manual' && name.trim() ? { courierName: name.trim() } : {}),
          ...(tracking.trim() && tracking.trim() !== shipment.trackingNumber
            ? { trackingNumber: tracking.trim() }
            : {}),
          ...(cost.trim() ? { cost: cost.trim() } : {}),
          ...(fee.trim() ? { codFee: fee.trim() } : {}),
        }),
      'Parcel details saved.',
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Edit parcel details</DialogTitle>
            <DialogDescription>
              A changed courier charge adds a correction line to the order costs; the history is
              kept.
            </DialogDescription>
          </DialogHeader>
          {shipment.courier === 'manual' ? (
            <FormField label="Courier or rider name">
              {(control) => (
                <Input
                  {...control}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <FormField label="Tracking number" error={firstError(form.errors, 'trackingNumber')}>
            {(control) => (
              <Input
                {...control}
                value={tracking}
                maxLength={80}
                onChange={(e) => setTracking(e.target.value)}
              />
            )}
          </FormField>
          {canSeeCost ? (
            <>
              <FormField
                label="Courier charge (BDT)"
                hint={shipment.cost ? `Now ${money(shipment.cost)}.` : undefined}
                error={firstError(form.errors, 'cost')}
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
              <FormField
                label="Collection fee (BDT)"
                hint={shipment.codFee ? `Now ${money(shipment.codFee)}.` : undefined}
                error={firstError(form.errors, 'codFee')}
              >
                {(control) => (
                  <Input
                    {...control}
                    inputMode="decimal"
                    value={fee}
                    maxLength={12}
                    onChange={(e) => setFee(e.target.value)}
                  />
                )}
              </FormField>
            </>
          ) : null}
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {form.error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={form.pending}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" loading={form.pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RtoDialog({
  open,
  onClose,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const form = useDialogForm(onClose);
  const [condition, setCondition] = useState<'resellable' | 'damaged'>('resellable');
  const [loss, setLoss] = useState('');
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    form.run(
      () =>
        receiveReturnToOriginAction({
          orderId,
          condition,
          ...(loss.trim() ? { loss: loss.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      'Parcel recorded as returned to origin.',
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>The parcel is back with us</DialogTitle>
            <DialogDescription>
              Goods that can be sold go back on the shelf. The loss is added to the order, and the
              customer&apos;s phone number is flagged for the team.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Condition of the goods" required>
            {(control) => (
              <NativeSelect
                {...control}
                value={condition}
                onChange={(e) => setCondition(e.target.value as 'resellable' | 'damaged')}
              >
                <option value="resellable">Fit to sell again</option>
                <option value="damaged">Damaged: do not restock</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField
            label="Loss on this order (BDT)"
            hint="The return courier fee and any other cost of bringing it back."
            error={firstError(form.errors, 'loss')}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={loss}
                maxLength={12}
                onChange={(e) => setLoss(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Note">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </FormField>
          <p role="alert" className="min-h-5 type-small text-danger-text">
            {form.error}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={form.pending}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" loading={form.pending}>
              Record return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
