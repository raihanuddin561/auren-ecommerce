'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { confirmStepUp } from '@/modules/identity/actions';
import {
  deleteOrderViewAction,
  exportOrdersCsvAction,
  saveOrderViewAction,
} from '@/modules/orders/list-actions';
import { ORDERS_EXPORT_STEP_UP } from '@/modules/orders/list-schemas';

/** Saved views of the orders list: a name for a combination of filters, kept per staff member. */
export function SavedViews({
  views,
  currentQuery,
}: {
  views: Array<{ name: string; query: string }>;
  currentQuery: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await saveOrderViewAction({ name: name.trim(), query: currentQuery });
      if (result.ok) {
        toast.success('View saved');
        setName('');
        setOpen(false);
        router.refresh();
      } else {
        toast.error('Could not save the view', failureMessage(result) ?? undefined);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Saved views" role="group">
      {views.map((view) => (
        <span key={view.name} className="inline-flex items-center">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/orders${view.query ? `?${view.query}` : ''}`}>{view.name}</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete the view ${view.name}`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteOrderViewAction({ name: view.name });
                if (result.ok) router.refresh();
              })
            }
          >
            x
          </Button>
        </span>
      ))}
      {currentQuery ? (
        open ? (
          <span className="inline-flex items-center gap-2">
            <Input
              aria-label="Name for this view"
              className="h-10 w-44"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
            <Button size="sm" loading={pending} disabled={!name.trim()} onClick={save}>
              Save view
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Save this view
          </Button>
        )
      ) : null}
    </div>
  );
}

/** Downloads the filtered orders as CSV after a fresh password confirmation. The export is audited. */
export function ExportButton({ query }: { query: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function download(csv: string, filename: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        if (needsPassword && password) {
          const confirmed = await confirmStepUp({
            method: 'password',
            purpose: ORDERS_EXPORT_STEP_UP,
            password,
          });
          if (!confirmed.ok) {
            setError(failureMessage(confirmed));
            return;
          }
          setPassword('');
        }
        const result = await exportOrdersCsvAction(query);
        if (result.ok) {
          download(result.data.csv, result.data.filename);
          toast.success(`${result.data.rows} orders exported`);
          setOpen(false);
          return;
        }
        if (result.error.code === 'STEP_UP_REQUIRED') {
          setNeedsPassword(true);
          setError('Confirm your password to export orders.');
          return;
        }
        setError(failureMessage(result));
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Export CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run();
            }}
            className="flex flex-col gap-5"
          >
            <DialogHeader>
              <DialogTitle>Export orders</DialogTitle>
              <DialogDescription>
                Downloads the orders that match the current filters (up to 5,000). The file has
                customer phone numbers, so the export is recorded with who, the filter and the
                number of rows.
              </DialogDescription>
            </DialogHeader>
            {needsPassword ? (
              <FormField label="Your password" required>
                {(control) => (
                  <Input
                    {...control}
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                )}
              </FormField>
            ) : null}
            <p role="alert" className="min-h-5 type-small text-danger-text">
              {error}
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" loading={pending}>
                Download
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
