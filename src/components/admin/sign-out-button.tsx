'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOutStaff } from './sign-out';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button variant="link" className="type-small" onClick={() => signOutStaff(router)}>
      Sign out
    </Button>
  );
}
