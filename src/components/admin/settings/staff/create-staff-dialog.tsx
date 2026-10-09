'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { STAFF_ROLES, type StaffRole } from '@/lib/permissions';
import { createStaffMemberAction } from '@/modules/staff/actions';

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({
  value: r,
  label:
    r === 'owner'
      ? 'Owner (Full Access)'
      : r === 'admin'
        ? 'Admin'
        : r === 'manager'
          ? 'Operations Manager'
          : r === 'order_verifier'
            ? 'Order Verifier'
            : r === 'fulfillment'
              ? 'Fulfilment & Warehouse'
              : r === 'finance'
                ? 'Finance & Accounting'
                : r === 'content_editor'
                  ? 'Content & Catalogue'
                  : 'Customer Support',
}));

export function CreateStaffDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('order_verifier');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('order_verifier');
    setTemporaryPassword('');
    setCreatedPassword(null);
    setCopied(false);
    setErrors({});
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const res = await createStaffMemberAction({
        name,
        email,
        role,
        temporaryPassword: temporaryPassword.trim() ? temporaryPassword.trim() : undefined,
      });

      if (res.ok) {
        toast.success(`Staff account created for ${name}`);
        setCreatedPassword(res.data.temporaryPassword);
        router.refresh();
      } else {
        toast.error(res.error.message ?? 'Failed to create staff account');
        if (res.error.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.error.fieldErrors)) {
            if (Array.isArray(v) && v[0]) {
              mapped[k] = v[0];
            }
          }
          setErrors(mapped);
        }
      }
    } catch {
      toast.error('Failed to create staff account');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (!createdPassword) return;
    navigator.clipboard.writeText(createdPassword);
    setCopied(true);
    toast.success('Temporary password copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Icon icon={Plus} size={16} className="mr-1.5" />
          <span>Add Staff Member</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        {createdPassword ? (
          <div className="flex flex-col gap-6 py-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon icon={UserPlus} size={20} className="text-success" />
                <span>Staff Account Created</span>
              </DialogTitle>
              <DialogDescription>
                A staff account for <strong className="text-fg">{email}</strong> has been
                provisioned. Provide them with this temporary password. They will be required to
                change it and configure 2FA upon first sign-in.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xs border border-line bg-raised p-4">
              <span className="type-eyebrow text-fg-muted">TEMPORARY PASSWORD (SHOWN ONCE)</span>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="font-mono text-base font-semibold tracking-wide text-fg select-all">
                  {createdPassword}
                </code>
                <Button variant="secondary" size="sm" onClick={copyPassword}>
                  <Icon icon={copied ? Check : Copy} size={14} className="mr-1.5" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Create credentials and configure role permissions for an atelier team member.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staffName">Full Name (required)</Label>
                <Input
                  id="staffName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asif Rahman"
                  required
                  autoFocus
                  disabled={loading}
                />
                {errors.name ? <p className="type-admin text-danger">{errors.name}</p> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staffEmail">Staff Email (required)</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. asif@auren.com"
                  required
                  disabled={loading}
                />
                {errors.email ? <p className="type-admin text-danger">{errors.email}</p> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Role & Permissions (required)</Label>
                <Select
                  value={role}
                  onValueChange={(val) => setRole(val as StaffRole)}
                  disabled={loading}
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
                {errors.role ? <p className="type-admin text-danger">{errors.role}</p> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staffTempPass">Custom Temporary Password (Optional)</Label>
                <Input
                  id="staffTempPass"
                  type="password"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  placeholder="Leave empty to auto-generate"
                  disabled={loading}
                />
                <p className="type-body-xs text-fg-muted">
                  Leave blank to automatically generate a secure temporary password.
                </p>
                {errors.temporaryPassword ? (
                  <p className="type-admin text-danger">{errors.temporaryPassword}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} disabled={loading}>
                Create Account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
