import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

export interface KpiDelta {
  /** Already formatted, for example "+12.4%". */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news. Colour is never the only signal: the arrow and sign stay. */
  tone?: 'good' | 'bad' | 'neutral';
  /** What the change is measured against, for example "vs last week". */
  comparedTo?: string;
}

interface KpiCardProps {
  label: string;
  /** Already formatted (money through lib/money, counts with separators). */
  value: ReactNode;
  delta?: KpiDelta;
  footnote?: string;
  state?: 'ready' | 'loading' | 'error' | 'empty';
  /** Message for the error and empty states. */
  stateMessage?: string;
  className?: string;
}

const deltaIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const deltaWords = { up: 'Up', down: 'Down', flat: 'Unchanged' } as const;

export function KpiCard({
  label,
  value,
  delta,
  footnote,
  state = 'ready',
  stateMessage,
  className,
}: KpiCardProps) {
  return (
    <section
      aria-label={label}
      aria-busy={state === 'loading' || undefined}
      className={cn('flex min-h-32 flex-col gap-3 border border-line bg-raised p-5', className)}
    >
      <p className="type-eyebrow text-fg-muted">{label}</p>

      {state === 'loading' ? (
        <div className="flex flex-col gap-2" role="status" aria-label={`Loading ${label}`}>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : state === 'error' ? (
        <p role="alert" className="type-admin text-danger-text">
          {stateMessage ?? 'This figure could not be loaded.'}
        </p>
      ) : state === 'empty' ? (
        <div>
          <p className="type-h2 font-sans font-medium text-fg-muted tabular-nums">
            <span aria-hidden="true">—</span>
            <span className="sr-only">No value yet</span>
          </p>
          {stateMessage ? <p className="mt-1 type-small text-fg-muted">{stateMessage}</p> : null}
        </div>
      ) : (
        <div>
          <p className="type-h2 font-sans font-medium text-fg tabular-nums">{value}</p>
          {delta ? (
            <p
              className={cn(
                'mt-1 flex items-center gap-1 type-small tabular-nums',
                delta.tone === 'good' && 'text-success-text',
                delta.tone === 'bad' && 'text-danger-text',
                (!delta.tone || delta.tone === 'neutral') && 'text-fg-muted',
              )}
            >
              <Icon icon={deltaIcon[delta.direction]} size={16} />
              <span className="sr-only">{deltaWords[delta.direction]} </span>
              {delta.value}
              {delta.comparedTo ? <span className="text-fg-muted"> {delta.comparedTo}</span> : null}
            </p>
          ) : null}
          {footnote ? <p className="mt-1 type-small text-fg-muted">{footnote}</p> : null}
        </div>
      )}
    </section>
  );
}
