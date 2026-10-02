import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { TwoFactorSetup } from '@/components/admin/two-factor-setup';
import { getStaff, requireStaffPendingTwoFactor } from '@/lib/staff';

export const metadata: Metadata = { title: 'Secure your account' };

async function SecurityGate() {
  await requireStaffPendingTwoFactor();
  const resolution = await getStaff();
  if (resolution.status === 'ok') redirect('/admin');
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
