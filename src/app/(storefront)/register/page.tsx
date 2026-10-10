import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/storefront/auth/register-form';

export const metadata: Metadata = {
  title: 'Client Registration | AUREN',
  description: 'Create an AUREN client account to access exclusive privileges and order history.',
  alternates: { canonical: '/register' },
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md animate-pulse py-12 text-center type-body-sm text-fg-muted">
            Loading registration...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
