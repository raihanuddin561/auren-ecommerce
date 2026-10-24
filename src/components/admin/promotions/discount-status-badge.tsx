import { Infinity as InfinityIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DiscountStatusBadgeProps {
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
}

export function DiscountStatusBadge({ isActive, startsAt, endsAt }: DiscountStatusBadgeProps) {
  const now = new Date();
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;

  if (!isActive) {
    return <Badge tone="neutral">Inactive</Badge>;
  }

  if (start > now) {
    return <Badge tone="outline">Scheduled</Badge>;
  }

  if (end && end < now) {
    return <Badge tone="warning">Expired</Badge>;
  }

  if (!end) {
    return (
      <Badge tone="gold" className="flex items-center gap-1">
        <InfinityIcon className="h-3 w-3" />
        Unlimited
      </Badge>
    );
  }

  return <Badge tone="success">Active</Badge>;
}
