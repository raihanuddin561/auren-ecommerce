'use client';

import { toast } from '@/components/ui/toast';
import { authClient } from '@/lib/auth-client';

interface Navigator {
  replace(path: string): void;
  refresh(): void;
}

/** Ends the staff session. Only leaves the console when the server confirmed it. */
export async function signOutStaff(router: Navigator): Promise<boolean> {
  try {
    const { error } = await authClient.signOut();
    if (error) throw new Error(error.message);
  } catch {
    toast.error('Could not sign you out', 'Check your connection and try again.');
    return false;
  }
  router.replace('/admin/sign-in');
  router.refresh();
  return true;
}
