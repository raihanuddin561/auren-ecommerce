import { Badge } from '@/components/ui/badge';
import type { StaffRole } from '@/lib/permissions';

interface StaffRoleBadgeProps {
  role: StaffRole;
}

export function StaffRoleBadge({ role }: StaffRoleBadgeProps) {
  switch (role) {
    case 'owner':
      return <Badge tone="gold">Owner</Badge>;
    case 'admin':
      return <Badge tone="oxblood">Admin</Badge>;
    case 'manager':
      return <Badge tone="ink">Manager</Badge>;
    case 'order_verifier':
      return <Badge tone="neutral">Order Verifier</Badge>;
    case 'fulfillment':
      return <Badge tone="outline">Fulfilment</Badge>;
    case 'finance':
      return <Badge tone="gold">Finance</Badge>;
    case 'content_editor':
      return <Badge tone="outline">Content Editor</Badge>;
    case 'support':
      return <Badge tone="neutral">Support</Badge>;
    default:
      return <Badge tone="neutral">{role}</Badge>;
  }
}
