'use client';

import { Check, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setProductStatus } from '@/modules/catalog/actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/toast';
import { failureMessage, fieldErrorsOf } from '../../action-feedback';
import { FormSection } from '../../form-section';
import { ConfirmDialog } from './confirm-dialog';
import { isReadyToPublish, type ProductStatus, type ReadinessItem } from './product-status';
import { ProductStatusBadge } from './status-badge';

interface StatusPanelProps {
  productId: string;
  status: ProductStatus;
  readiness: ReadinessItem[];
  canPublish: boolean;
}

const CONFIRM: Partial<
  Record<ProductStatus, { title: string; description: string; label: string }>
> = {
  archived: {
    title: 'Archive this product?',
    description: 'Shoppers will no longer see it in the shop or find it by its address.',
    label: 'Archive product',
  },
  draft: {
    title: 'Move this product to draft?',
    description: 'It leaves the shop at once and stays hidden until you publish it again.',
    label: 'Move to draft',
  },
};

/** Current status, the publish checklist, and the status buttons (catalog.publish only). */
export function StatusPanel({ productId, status, readiness, canPublish }: StatusPanelProps) {
  const router = useRouter();
  const [target, setTarget] = useState<ProductStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const ready = isReadyToPublish(readiness);

  async function change(next: ProductStatus) {
    setPending(true);
    setProblems([]);
    const result = await setProductStatus({ id: productId, status: next });
    setPending(false);
    setTarget(null);
    if (!result.ok) {
      const fields = fieldErrorsOf(result);
      const messages = fields.status ?? [failureMessage(result) ?? 'The status was not changed.'];
      setProblems(messages);
      toast.error('Status was not changed', messages.join(' '));
      return;
    }
    toast.success(
      next === 'active'
        ? 'Product published'
        : next === 'archived'
          ? 'Product archived'
          : 'Product moved to draft',
    );
    router.refresh();
  }

  function request(next: ProductStatus) {
    if (CONFIRM[next]) setTarget(next);
    else void change(next);
  }

  const confirm = target ? CONFIRM[target] : undefined;

  return (
    <FormSection
      title="Status and publishing"
      description="Only active products are visible in the shop."
    >
      <div id="status" className="flex flex-col gap-5">
        <p className="flex items-center gap-3 type-admin">
          Current status: <ProductStatusBadge status={status} />
        </p>

        {status !== 'active' ? (
          <div className="flex flex-col gap-2">
            <h3 className="type-small font-medium text-fg">Before it can go live</h3>
            <ul className="flex flex-col gap-1.5">
              {readiness.map((item) => (
                <li key={item.id} className="flex items-center gap-2 type-admin">
                  <Icon
                    icon={item.met ? Check : Circle}
                    size={16}
                    className={item.met ? 'text-success-text' : 'text-fg-muted'}
                  />
                  <span>{item.label}</span>
                  <span className="type-small text-fg-muted">{item.met ? 'Done' : 'Missing'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {problems.length > 0 ? (
          <div role="alert" className="type-small text-danger-text">
            {problems.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        {canPublish ? (
          <div className="flex flex-wrap gap-3">
            {status !== 'active' ? (
              <Button
                size="sm"
                loading={pending && target === null}
                onClick={() => request('active')}
              >
                Publish
              </Button>
            ) : null}
            {status !== 'draft' ? (
              <Button size="sm" variant="secondary" onClick={() => request('draft')}>
                Move to draft
              </Button>
            ) : null}
            {status !== 'archived' ? (
              <Button size="sm" variant="secondary" onClick={() => request('archived')}>
                Archive
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="type-small text-fg-muted">
            Your role can edit this product but not publish or archive it.
          </p>
        )}
        {canPublish && status !== 'active' && !ready ? (
          <p className="type-small text-fg-muted">
            Publishing is checked again on the server, so you can try it, but it will be refused
            until the list above is complete.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => (open ? undefined : setTarget(null))}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.label ?? 'Confirm'}
        danger={target === 'archived'}
        pending={pending}
        onConfirm={() => (target ? void change(target) : undefined)}
      />
    </FormSection>
  );
}
