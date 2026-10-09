'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { addOrderNoteAction } from '@/modules/orders/actions';

/** A note on the order timeline, visible to staff only. */
export function AddNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await addOrderNoteAction({ orderId, note: note.trim() });
        if (result.ok) {
          setNote('');
          toast.success('Note added');
          router.refresh();
        } else {
          setError(failureMessage(result));
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
      <label htmlFor={`note-${orderId}`} className="type-small text-fg-muted">
        Add a note for the team
      </label>
      <div className="flex gap-2">
        <Input
          id={`note-${orderId}`}
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="h-10"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={pending}
          disabled={!note.trim()}
        >
          Add
        </Button>
      </div>
      <p role="alert" className="min-h-4 type-small text-danger-text">
        {error}
      </p>
    </form>
  );
}
