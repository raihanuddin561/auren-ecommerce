'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { SortableList } from '@/components/admin/sortable-list';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/toast';
import { removeCollectionProduct, reorderCollectionProducts } from '@/modules/catalog/actions';
import { ProductPicker } from './product-picker';
import { ProductStatusBadge, ProductThumb } from './product-thumb';

export interface CollectionMember {
  productId: string;
  title: string;
  status: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

interface MembersPanelProps {
  collectionId: string;
  type: 'manual' | 'automatic';
  members: CollectionMember[];
  canWrite: boolean;
}

function MemberRow({ member, action }: { member: CollectionMember; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <ProductThumb url={member.imageUrl} alt={member.imageAlt ?? ''} />
      <span className="min-w-0 flex-1 truncate type-admin text-fg">{member.title}</span>
      <ProductStatusBadge status={member.status} />
      {action}
    </div>
  );
}

/**
 * Members of a collection. A manual one can be reordered, trimmed and extended; an automatic one
 * follows its rules, so its members are only listed.
 */
export function MembersPanel({ collectionId, type, members, canWrite }: MembersPanelProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function reorder(orderedProductIds: string[]): Promise<boolean> {
    const response = await reorderCollectionProducts({ collectionId, orderedProductIds });
    if (!response.ok) {
      toast.error(failureMessage(response) ?? 'The new order could not be saved.');
      return false;
    }
    return true;
  }

  async function remove(member: CollectionMember) {
    setRemoving(member.productId);
    const response = await removeCollectionProduct({ collectionId, productId: member.productId });
    setRemoving(null);
    if (!response.ok) {
      toast.error(failureMessage(response) ?? 'The product could not be removed.');
      return;
    }
    toast.success('Removed from the collection', member.title);
    router.refresh();
  }

  const count = members.length === 1 ? '1 product' : `${members.length} products`;

  if (type === 'automatic') {
    return (
      <div className="flex flex-col gap-4">
        <p className="type-admin text-fg-muted">
          These products follow the rules above, so they cannot be added or reordered by hand.
          Change the rules, or use Refresh members after products change. Currently {count}.
        </p>
        {members.length === 0 ? (
          <p className="border border-dashed border-line-strong px-4 py-6 type-admin text-fg-muted">
            No products match the saved rules yet.
          </p>
        ) : (
          <ul aria-label="Members" className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.productId} className="border border-line bg-raised p-3">
                <MemberRow member={member} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="type-admin text-fg-muted">
        {members.length === 0
          ? 'No products yet. Search below to add some.'
          : `${count}. Drag to reorder, or use the earlier and later buttons.`}
      </p>
      {members.length > 0 ? (
        <SortableList
          label="Collection products"
          disabled={!canWrite}
          onReorder={reorder}
          items={members.map((member) => ({
            id: member.productId,
            label: member.title,
            content: (
              <MemberRow
                member={member}
                action={
                  canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${member.title} from the collection`}
                      loading={removing === member.productId}
                      disabled={removing !== null}
                      onClick={() => remove(member)}
                    >
                      <Icon icon={X} size={18} />
                    </Button>
                  ) : null
                }
              />
            ),
          }))}
        />
      ) : null}
      {canWrite ? (
        <ProductPicker
          collectionId={collectionId}
          memberIds={members.map((m) => m.productId)}
          disabled={false}
        />
      ) : null}
    </div>
  );
}
