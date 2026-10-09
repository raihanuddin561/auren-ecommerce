'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, MapPin, Package, SlidersHorizontal, User } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { authClient } from '@/lib/auth-client';

interface AccountNavProps {
  user: {
    name: string;
    email: string;
  };
}

const NAV_ITEMS = [
  { href: '/account', label: 'Overview', icon: User, exact: true },
  { href: '/account/orders', label: 'Order History', icon: Package, exact: false },
  { href: '/account/addresses', label: 'Address Book', icon: MapPin, exact: false },
  { href: '/account/profile', label: 'Profile & Sizing', icon: SlidersHorizontal, exact: false },
];

export function AccountNav({ user }: AccountNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login');
          router.refresh();
        },
      },
    });
  }

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="rounded-xs border border-line bg-raised p-6">
        <div className="border-b border-line pb-5">
          <span className="type-eyebrow tracking-widest text-accent-text">PRIVATE CLIENT</span>
          <h2 className="mt-1 truncate type-h3 font-display text-fg">{user.name}</h2>
          <p className="type-body-xs truncate text-fg-muted">{user.email}</p>
        </div>

        <nav aria-label="Account navigation" className="mt-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'type-body-sm flex items-center gap-3 rounded-xs px-3 py-2.5 transition-colors',
                  isActive
                    ? 'border-l-2 border-accent-text bg-page font-medium text-fg'
                    : 'text-fg-muted hover:bg-page/50 hover:text-fg',
                )}
              >
                <Icon
                  icon={item.icon}
                  className={cn('size-4 shrink-0', isActive ? 'text-accent-text' : 'text-fg-muted')}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="type-body-sm mt-4 flex w-full items-center gap-3 rounded-xs px-3 py-2.5 text-left text-fg-muted transition-colors hover:bg-danger/5 hover:text-danger"
          >
            <Icon icon={LogOut} className="size-4 shrink-0 text-fg-muted" />
            <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </nav>
      </div>

      <div className="mt-4 rounded-xs border border-line/60 bg-page p-5">
        <h3 className="type-body-xs font-medium tracking-wider text-fg uppercase">
          Atelier Concierge
        </h3>
        <p className="type-body-xs mt-1 leading-relaxed text-fg-muted">
          Need a private fitting in Gulshan or bespoke garment alteration?
        </p>
        <Link
          href="/contact"
          className="type-body-xs mt-3 inline-block text-accent-text underline underline-offset-4 hover:text-accent-text/80"
        >
          Book Appointment →
        </Link>
      </div>
    </aside>
  );
}
