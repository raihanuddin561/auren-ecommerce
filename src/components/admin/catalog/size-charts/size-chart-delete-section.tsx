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
import { deleteSizeChart } from '@/modules/catalog/actions';

interface SizeChartDeleteSectionProps {
  id: string;
  name: string;
  productCount: number;
}

export function SizeChartDeleteSection({ id, name, productCount }: SizeChartDeleteSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const consequence =
    productCount === 0
      ? 'No product uses this chart.'
      : `${productCount} product${productCount === 1 ? ' uses' : 's use'} this chart and will no longer show a size chart.`;

  function confirm() {
    setProblem(null);
    startTransition(async () => {
      const result = await deleteSizeChart({ id });
      if (!result.ok) {
        setProblem(failureMessage(result));
        toast.error(failureMessage(result) ?? 'The size chart could not be deleted.');
        return;
      }
      toast.success('Size chart deleted');
      setOpen(false);
      router.push('/admin/size-charts');
    });
  }

  return (
    <FormSection
      title="Delete size chart"
      description="Products keep everything else; only their size chart is removed."
    >
      <p className="type-admin text-fg-muted">{consequence}</p>
      <div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete size chart
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
            <DialogDescription>{consequence} This cannot be undone.</DialogDescription>
          </DialogHeader>
          <p role="alert" className="mt-4 type-admin text-danger-text">
            {problem}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                Keep size chart
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={confirm} loading={pending}>
              Delete size chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormSection>
  );
}
