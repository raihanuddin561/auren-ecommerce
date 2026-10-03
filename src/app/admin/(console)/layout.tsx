import { Suspense } from 'react';
import { AdminShellSkeleton } from '@/components/admin/shell/shell-skeleton';
import { StaffGate } from '@/components/admin/shell/staff-gate';

export default function AdminConsoleLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <StaffGate>{children}</StaffGate>
    </Suspense>
  );
}
