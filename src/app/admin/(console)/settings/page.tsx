import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';

export const metadata: Metadata = { title: 'Settings' };

const SECTIONS = [
  {
    href: '/admin/settings/general',
    title: 'Store Information',
    description:
      'Brand identity, concierge email/phone, Dhaka studio location, VAT/BIN configuration, and social channels.',
  },
  {
    href: '/admin/settings/navigation',
    title: 'Navigation & Menu Bar',
    description:
      'Primary menu items, drop-down category columns, and promotional feature tiles for the storefront header.',
  },
  {
    href: '/admin/settings/staff',
    title: 'Staff & Permissions',
    description:
      'Manage team members, assign operational roles, send staff invitations, and review account security status.',
  },
  {
    href: '/admin/settings/shipping',
    title: 'Delivery and checkout',
    description:
      'Delivery zones and rates, free delivery, cash on delivery limits and checkout protection.',
  },
  {
    href: '/admin/settings/orders',
    title: 'Orders and fulfilment',
    description:
      'Verification rules and working hours, the return window, and packaging costs added to each order.',
  },
  {
    href: '/admin/settings/carousel',
    title: 'Hero carousel & banners',
    description:
      'Homepage hero slides, campaign imagery, editorial messaging, and call-to-actions.',
  },
  {
    href: '/admin/settings/audit',
    title: 'Audit Log & History',
    description:
      'Immutable trail of administrative modifications, role adjustments, and security operations.',
  },
  {
    href: '/admin/settings/health',
    title: 'System Health & Pipeline',
    description:
      'Live database latency probes, outbox event queue status, worker health, and integration diagnostics.',
  },
] as const;

export default async function SettingsPage() {
  await requireStaffWith('settings.manage');
  return (
    <>
      <PageHeader
        title="Settings"
        description="How the shop is run. Changes are recorded in the audit log."
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex h-full flex-col gap-1 border border-line bg-raised p-5 transition-auren-fast hover:border-fg"
            >
              <span className="type-h3 text-fg">{section.title}</span>
              <span className="type-admin text-fg-muted">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
