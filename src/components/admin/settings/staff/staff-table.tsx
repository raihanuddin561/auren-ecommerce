'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { STAFF_ROLES, type StaffRole } from '@/lib/permissions';
import { toggleStaffStatusAction, updateStaffRoleAction } from '@/modules/staff/actions';
import type { StaffMemberRecord } from '@/modules/staff/types';
import { StaffRoleBadge } from './staff-role-badge';

interface StaffTableProps {
  staffList: StaffMemberRecord[];
  currentStaffId: string;
}

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({
  value: r,
  label:
    r === 'owner'
      ? 'Owner'
      : r === 'admin'
        ? 'Admin'
        : r === 'manager'
          ? 'Manager'
          : r === 'order_verifier'
            ? 'Order Verifier'
            : r === 'fulfillment'
              ? 'Fulfilment'
              : r === 'finance'
                ? 'Finance'
                : r === 'content_editor'
                  ? 'Content Editor'
                  : 'Support',
}));

export function StaffTable({ staffList, currentStaffId }: StaffTableProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const handleToggleActive = async (member: StaffMemberRecord) => {
    setTogglingId(member.id);
    try {
      const res = await toggleStaffStatusAction({
        staffId: member.id,
        active: !member.active,
      });

      if (res.ok) {
        toast.success(`${member.name} has been ${!member.active ? 'activated' : 'deactivated'}.`);
        router.refresh();
      } else {
        toast.error(res.error.message ?? 'Failed to update staff status');
      }
    } catch {
      toast.error('Failed to update staff status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRoleChange = async (member: StaffMemberRecord, newRole: StaffRole) => {
    if (newRole === member.role) return;
    setChangingRoleId(member.id);
    try {
      const res = await updateStaffRoleAction({
        staffId: member.id,
        role: newRole,
      });

      if (res.ok) {
        toast.success(`Role updated for ${member.name}`);
        router.refresh();
      } else {
        toast.error(res.error.message ?? 'Failed to update staff role');
      }
    } catch {
      toast.error('Failed to update staff role');
    } finally {
      setChangingRoleId(null);
    }
  };

  return (
    <div className="overflow-x-auto border border-line bg-page">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-raised type-eyebrow text-fg-muted">
          <tr>
            <th className="px-4 py-3">Team Member</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Security & 2FA</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {staffList.map((member) => {
            const isSelf = member.id === currentStaffId;
            const isOwner = member.role === 'owner';
            const isToggling = togglingId === member.id;
            const isRoleChanging = changingRoleId === member.id;

            return (
              <tr key={member.id} className="transition-colors hover:bg-raised/50">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      <span>{member.name}</span>
                      {isSelf ? (
                        <Badge tone="neutral" className="px-1 py-0 type-caption">
                          You
                        </Badge>
                      ) : null}
                    </span>
                    <span className="type-admin text-fg-muted">{member.email}</span>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {isSelf || isOwner ? (
                    <StaffRoleBadge role={member.role} />
                  ) : (
                    <div className="w-44">
                      <Select
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member, val as StaffRole)}
                        disabled={isRoleChanging || isToggling}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {member.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 type-admin text-success">
                        <Icon icon={ShieldCheck} size={14} />
                        <span>2FA Enrolled</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 type-admin text-warning-text">
                        <Icon icon={ShieldAlert} size={14} />
                        <span>2FA Pending</span>
                      </span>
                    )}
                    {member.mustChangePassword ? (
                      <span className="type-body-xs text-fg-muted">Password change required</span>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3">
                  {member.active ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Deactivated</Badge>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {isOwner || isSelf ? (
                    <span className="type-admin text-fg-muted italic">—</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isToggling || isRoleChanging}
                      loading={isToggling}
                      onClick={() => handleToggleActive(member)}
                    >
                      {member.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
