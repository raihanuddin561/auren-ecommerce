import type { Metadata } from 'next';
import { connection } from 'next/server';
import { requireUser } from '@/lib/auth';
import { AccountNav } from '@/components/storefront/account/account-nav';

export const metadata: Metadata = {
  title: 'Client Account | AUREN',
  description: 'Private client portal for wardrobe curations, commissions, and atelier services.',
};

/**
 * Account pages carry per-request Content-Security-Policy nonces (ADR-022).
 * `instant = false` opts out of static prerendering for this nonce-bearing section.
 */
export const instant = false;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireUser();

  return (
    <main className="min-h-[80vh] py-10 md:py-16">
      <div className="container-page">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-12">
          <AccountNav user={{ name: user.name, email: user.email }} />
          <section className="w-full min-w-0 flex-1">{children}</section>
        </div>
      </div>
    </main>
  );
}
