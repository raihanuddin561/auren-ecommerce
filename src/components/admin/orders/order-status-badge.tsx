import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type OrderStatus } from '@/modules/orders/timeline';

const TONE: Partial<
  Record<OrderStatus, 'gold' | 'success' | 'warning' | 'neutral' | 'danger' | 'ink'>
> = {
  placed: 'gold',
  under_verification: 'gold',
  on_hold: 'warning',
  confirmed: 'success',
  processing: 'success',
  shipped: 'ink',
  delivered: 'success',
  completed: 'success',
  cancelled: 'neutral',
  delivery_failed: 'danger',
};

/** The status is always written out: colour is never the only signal. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{STATUS_LABEL[status]}</Badge>;
}
