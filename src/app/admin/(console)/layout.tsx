import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import { AdminShellSkeleton } from '@/components/admin/shell/shell-skeleton';
import { DomainError } from '@/lib/errors';
import { requireStaff } from '@/lib/staff';

async function AdminShellWithStaff({ children }: { children: React.ReactNode }) {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    // Not staff: the console does not exist for you (404), so it cannot be probed by customers.
    if (error instanceof DomainError && error.code === 'FORBIDDEN') notFound();
    throw error;
  }
  return (
    <AdminShell
      staff={{
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: [...staff.permissions],
      }}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminConsoleLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShellWithStaff>{children}</AdminShellWithStaff>
    </Suspense>
  );
}
