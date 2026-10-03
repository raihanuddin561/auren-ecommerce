'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { signOutEverywhere } from '@/modules/identity/actions';

/** Ends every session of this account on every device, including this one. */
export function SignOutEverywhereButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const result = await signOutEverywhere();
    setPending(false);
    if (!result.ok) {
      if (result.error.code === 'UNAUTHENTICATED') {
        router.replace('/admin/sign-in');
        return;
      }
      toast.error('Could not sign you out everywhere', result.error.message ?? 'Please try again.');
      return;
    }
    router.replace('/admin/sign-in');
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" loading={pending} onClick={onClick}>
      Sign out of every device
    </Button>
  );
}
