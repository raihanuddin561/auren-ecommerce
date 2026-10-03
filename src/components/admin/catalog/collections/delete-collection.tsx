'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/toast';
import { deleteCollection } from '@/modules/catalog/actions';

interface DeleteCollectionProps {
  collectionId: string;
  title: string;
  isLive: boolean;
}

/** Delete with a confirmation. The products stay; only the collection goes. */
export function DeleteCollection({ collectionId, title, isLive }: DeleteCollectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const response = await deleteCollection({ id: collectionId });
    if (!response.ok) {
      setPending(false);
      toast.error(failureMessage(response) ?? 'The collection could not be deleted.');
      return;
    }
    toast.success('Collection deleted', title);
    setOpen(false);
    router.push('/admin/collections');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Icon icon={Trash2} size={16} />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this collection</DialogTitle>
          <DialogDescription>
            {`"${title}" will be removed. The products in it stay in your catalogue.`}
            {isLive ? ' It is live now, so shoppers will no longer find it.' : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={pending}>
              Keep collection
            </Button>
          </DialogClose>
          <Button type="button" variant="danger" loading={pending} onClick={confirm}>
            Delete collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
