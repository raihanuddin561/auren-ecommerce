import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { PasswordChangeForm } from '@/components/admin/password-change-form';
import { SignOutEverywhereButton } from '@/components/admin/sign-out-everywhere-button';
import { requireStaff } from '@/lib/staff';

export const metadata: Metadata = { title: 'Account security' };

export default async function AdminAccountPage() {
  // The layout checks too, but pages never rely on it: layouts do not re-run on client navigation.
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Account security"
        description="Your password and the devices signed in to your account."
      />
      <div className="grid max-w-3xl gap-10">
        <section aria-labelledby="password-heading" className="flex max-w-md flex-col gap-4">
          <h2 id="password-heading" className="type-h3 font-sans font-medium">
            Password
          </h2>
          <PasswordChangeForm />
        </section>
        <section aria-labelledby="devices-heading" className="flex max-w-md flex-col gap-4">
          <h2 id="devices-heading" className="type-h3 font-sans font-medium">
            Signed-in devices
          </h2>
          <p className="type-small">
            If you lost a device or shared a computer, sign out everywhere. Staff sessions also end
            on their own about ten hours after sign-in.
          </p>
          <div>
            <SignOutEverywhereButton />
          </div>
        </section>
      </div>
    </>
  );
}
