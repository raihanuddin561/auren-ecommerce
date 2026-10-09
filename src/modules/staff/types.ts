import type { StaffRole } from '@/lib/permissions';

export interface StaffMemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  invitedBy: string | null;
}
