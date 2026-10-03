import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type ProductStatus } from './product-status';

const TONE = { draft: 'outline', active: 'success', archived: 'neutral' } as const;

/** Status is always written out: colour is never the only signal. */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
