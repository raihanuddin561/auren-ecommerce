import { Suspense } from 'react';
import { AccessDenied } from '@/components/admin/access-denied';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import { AdminShellSkeleton } from '@/components/admin/shell/shell-skeleton';
import { DomainError } from '@/lib/errors';
import { requireStaff } from '@/lib/staff';

async function AdminShellWithStaff({ children }: { children: React.ReactNode }) {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    // Not staff: say so here, because an error boundary in this segment cannot catch the layout.
    if (error instanceof DomainError && error.code === 'FORBIDDEN') return <AccessDenied />;
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
