import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/admin/sign-in-form';

export const metadata: Metadata = { title: 'Staff sign in' };

async function SignIn({ searchParams }: Pick<PageProps<'/admin/sign-in'>, 'searchParams'>) {
  const { next } = await searchParams;
  return <SignInForm next={typeof next === 'string' ? next : undefined} />;
}

export default function AdminSignInPage({ searchParams }: PageProps<'/admin/sign-in'>) {
  return (
    <>
      <h1 className="type-h1 font-sans font-medium">Staff sign in</h1>
      <Suspense fallback={<p aria-busy="true">Loading</p>}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </>
  );
}
