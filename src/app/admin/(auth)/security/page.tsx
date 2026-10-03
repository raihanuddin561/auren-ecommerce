import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { DomainError } from '@/lib/errors';
import { PasswordChangeForm } from '@/components/admin/password-change-form';
import { TwoFactorSetup } from '@/components/admin/two-factor-setup';
import { getStaff, requireStaffPendingSecurity } from '@/lib/staff';

export const metadata: Metadata = { title: 'Secure your account' };

async function SecurityGate() {
  try {
    await requireStaffPendingSecurity();
  } catch (error) {
    // A signed-in customer gets the same 404 as for any other console page.
    if (error instanceof DomainError && error.code === 'FORBIDDEN') notFound();
    throw error;
  }
  const resolution = await getStaff();
  if (resolution.status === 'ok') redirect('/admin');
  if (resolution.status === 'password_change_required') {
    return (
      <PasswordChangeForm lead="You signed in with a temporary password. Choose your own to continue." />
    );
  }
  return <TwoFactorSetup />;
}

export default function AdminSecurityPage() {
  return (
    <>
      <h1 className="type-h1 font-sans font-medium">Secure your account</h1>
      <Suspense fallback={<p aria-busy="true">Loading</p>}>
        <SecurityGate />
      </Suspense>
    </>
  );
}
