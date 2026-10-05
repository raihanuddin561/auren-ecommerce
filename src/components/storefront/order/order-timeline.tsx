import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { Timeline } from '@/modules/orders/timeline';

/** Placed, Verified, Shipped, Delivered. A hairline joins the steps; gold marks where the order is now. */
export function OrderTimeline({ timeline }: { timeline: Timeline }) {
  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Order progress" className="grid grid-cols-4">
        {timeline.steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="relative flex flex-col items-center gap-3 text-center"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-3 right-1/2 h-px w-full',
                  step.state === 'upcoming' ? 'bg-line-strong' : 'bg-fg',
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 inline-flex size-6 items-center justify-center rounded-full border',
                step.state === 'done' && 'border-fg bg-fg text-page',
                step.state === 'current' && 'border-gold bg-page text-fg ring-2 ring-gold/40',
                step.state === 'upcoming' && 'border-line-strong bg-page',
              )}
            >
              {step.state === 'done' ? <Icon icon={Check} size={14} /> : null}
              {step.state === 'current' ? <span className="size-2 rounded-full bg-gold" /> : null}
            </span>
            <span
              className={cn(
                'type-small',
                step.state === 'upcoming' ? 'text-fg-muted' : 'text-fg',
                step.state === 'current' && 'font-medium',
              )}
            >
              {step.label}
              <span className="sr-only">
                {step.state === 'done'
                  ? ', done'
                  : step.state === 'current'
                    ? ', current step'
                    : ', not yet'}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-center type-body text-fg-muted" role="status">
        {timeline.note}
      </p>
    </div>
  );
}
