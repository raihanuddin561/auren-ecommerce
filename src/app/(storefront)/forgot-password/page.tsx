import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/storefront/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Password Recovery | AUREN',
  description: 'Recover your AUREN client account password securely.',
  alternates: { canonical: '/forgot-password' },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md animate-pulse py-12 text-center type-body-sm text-fg-muted">
            Loading recovery form...
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}
