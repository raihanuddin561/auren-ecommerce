import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/storefront/auth/login-form';

export const metadata: Metadata = {
  title: 'Client Sign In | AUREN',
  description:
    'Sign in to your private AUREN client account to access your orders and preferences.',
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="type-body-sm mx-auto w-full max-w-md animate-pulse py-12 text-center text-fg-muted">
            Loading sign in...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
