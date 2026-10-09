import { Badge } from '@/components/ui/badge';

export function CustomerStatusBadge({ banned }: { banned: boolean }) {
  if (banned) {
    return <Badge tone="danger">Blocked</Badge>;
  }
  return <Badge tone="success">Active</Badge>;
}
