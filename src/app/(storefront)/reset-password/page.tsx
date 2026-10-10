import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/storefront/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password | AUREN',
  description: 'Update your client account password securely.',
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md animate-pulse py-12 text-center type-body-sm text-fg-muted">
            Validating reset token...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
