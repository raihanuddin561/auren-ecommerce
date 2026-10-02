'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { isAdminNavActive, visibleAdminNav } from '@/lib/admin-nav';

interface SidebarNavProps {
  /** Landmark name; unique when the navigation appears more than once on a page. */
  label?: string;
  permissions: readonly string[];
  /** Called when a link is chosen, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

const rowClass =
  'flex min-h-11 items-center gap-3 rounded-sm px-3 type-admin transition-auren-fast';

export function SidebarNav({ permissions, onNavigate, label = 'Admin' }: SidebarNavProps) {
  const pathname = usePathname();
  const groups = visibleAdminNav(permissions);

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 type-eyebrow text-fg-muted">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.ready && isAdminNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  {item.ready ? (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={cn(
                        rowClass,
                        active
                          ? 'relative bg-sunken font-medium text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-gold'
                          : 'text-fg-muted hover:bg-sunken hover:text-fg',
                      )}
                    >
                      <Icon icon={item.icon} size={18} />
                      {item.label}
                    </Link>
                  ) : (
                    <span className={cn(rowClass, 'cursor-default justify-between text-fg-muted')}>
                      <span className="flex items-center gap-3">
                        <Icon icon={item.icon} size={18} />
                        {item.label}
                      </span>
                      <Badge tone="outline" className="text-fg-muted">
                        Soon
                      </Badge>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Wordmark block shared by the desktop sidebar and the mobile drawer. */
export function SidebarBrand() {
  return (
    <div className="flex h-14 items-center gap-3 px-5">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center type-wordmark text-h3 leading-none text-fg"
        aria-label="AUREN admin home"
      >
        AUREN
      </Link>
      <span className="type-eyebrow text-fg-muted">Admin</span>
    </div>
  );
}
