import { notFound } from 'next/navigation';
import { DomainError } from '@/lib/errors';
import { requireStaff } from '@/lib/staff';
import { AdminShell } from './admin-shell';

/**
 * Resolves the signed-in staff member for the console. Anyone who is not staff gets a 404, so the
 * console cannot be probed by customers; other failures are not hidden.
 */
export async function StaffGate({ children }: { children: React.ReactNode }) {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
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
