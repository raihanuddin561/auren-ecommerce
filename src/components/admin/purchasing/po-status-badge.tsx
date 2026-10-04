import { Badge } from '@/components/ui/badge';

export const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

const TONE = {
  draft: 'outline',
  ordered: 'gold',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'neutral',
} as const;

/** The status is always written out: colour is never the only signal. */
export function PoStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={TONE[status as keyof typeof TONE] ?? 'neutral'}>
      {PO_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
