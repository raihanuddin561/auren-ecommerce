'use client';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function ToastDemo() {
  return (
    <>
      <Button variant="secondary" onClick={() => toast.success('Added to your bag')}>
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.error('Payment did not go through', 'Your bag is saved. Try again.')}
      >
        Error toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.undoable('Removed from your bag', () => toast.message('Restored'))}
      >
        Undo toast
      </Button>
    </>
  );
}
