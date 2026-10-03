'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { FormSection } from '@/components/admin/form-section';
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
import { toast } from '@/components/ui/toast';
import { deleteCategory } from '@/modules/catalog/actions';

interface CategoryDeleteSectionProps {
  id: string;
  name: string;
  productCount: number;
  childCount: number;
}

function blockedReason(productCount: number, childCount: number): string | null {
  const parts = [
    productCount > 0 ? `${productCount} product${productCount === 1 ? '' : 's'}` : null,
    childCount > 0 ? `${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `This category has ${parts.join(' and ')}. Move them before deleting.`
    : null;
}

export function CategoryDeleteSection({
  id,
  name,
  productCount,
  childCount,
}: CategoryDeleteSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const reason = blockedReason(productCount, childCount);

  function confirm() {
    setProblem(null);
    startTransition(async () => {
      const result = await deleteCategory({ id });
      if (!result.ok) {
        // The server's wording is friendly: it names what is still inside the category.
        setProblem(failureMessage(result));
        toast.error(failureMessage(result) ?? 'The category could not be deleted.');
        return;
      }
      toast.success('Category deleted');
      setOpen(false);
      router.push('/admin/categories');
    });
  }

  return (
    <FormSection
      title="Delete category"
      description="A category can only be deleted when it has no products and no sub-categories."
    >
      <p className="type-admin text-fg-muted">
        {reason ?? 'Deleting removes the category from the storefront. This cannot be undone.'}
      </p>
      <div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)} disabled={reason !== null}>
          Delete category
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setProblem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}</DialogTitle>
            <DialogDescription>
              This removes the category permanently. Links to it will stop working.
            </DialogDescription>
          </DialogHeader>
          <p role="alert" className="mt-4 type-admin text-danger-text">
            {problem}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                Keep category
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={confirm} loading={pending}>
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormSection>
  );
}
