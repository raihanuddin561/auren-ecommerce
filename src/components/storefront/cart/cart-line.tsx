'use client';

import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import type { CartLineView } from '@/modules/cart/view';
import { changeQuantity, removeLine, saveLineForLater } from './cart-client';

const ISSUE_TEXT: Record<NonNullable<CartLineView['issue']>, string> = {
  unavailable: 'No longer available. Please remove it to continue.',
  sold_out: 'Sold out in this size. Please remove it to continue.',
  short: 'Fewer pieces are left than you chose. Lower the quantity to continue.',
};

interface CartLineProps {
  line: CartLineView;
  /** Smaller type and image inside the drawer. */
  compact?: boolean;
}

/** One bag line: image, name, choices, quantity stepper, price, remove and save for later. */
export function CartLine({ line, compact = false }: CartLineProps) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const working = pending || busy;
  const href = `/products/${line.productSlug}`;
  const max = Math.max(1, line.maxQuantity);

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setBusy(false);
      }
    });
  };

  const price = deserialize(line.unitPrice);
  const compareAt = line.compareAt ? deserialize(line.compareAt) : null;
  const lineTotal = deserialize(line.lineTotal);

  return (
    <li className="flex gap-4 py-6 first:pt-0" aria-busy={working}>
      <Link
        href={href}
        className={cn(
          'relative block shrink-0 overflow-hidden bg-stone-200',
          compact ? 'w-20' : 'w-24 md:w-32',
        )}
        style={{ aspectRatio: '4 / 5' }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {line.image ? (
          <Image
            src={line.image.url}
            alt=""
            fill
            sizes={compact ? '80px' : '(min-width: 768px) 128px, 96px'}
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={href}
              className="block truncate type-body text-fg underline-offset-4 hover:underline"
            >
              {line.productTitle}
            </Link>
            <p className="type-small text-fg-muted">{line.optionsLabel}</p>
          </div>
          <Price price={lineTotal} size="sm" className="shrink-0" />
        </div>

        {line.quantity > 1 ? (
          <p className="type-small text-fg-muted">
            <Price price={price} compareAt={compareAt} size="sm" /> each
          </p>
        ) : compareAt ? (
          <Price price={price} compareAt={compareAt} size="sm" />
        ) : null}

        {line.issue ? (
          <p role="alert" className="type-small text-danger-text">
            {ISSUE_TEXT[line.issue]}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div
            role="group"
            aria-label={`Quantity of ${line.productTitle}`}
            className="flex items-center border border-line-strong"
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.productTitle}`}
              disabled={working || line.quantity <= 1}
              onClick={() => run(() => changeQuantity(line.variantId, line.quantity - 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Minus} size={16} />
            </button>
            <output aria-live="polite" className="w-8 text-center type-small tabular-nums">
              {line.quantity}
            </output>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.productTitle}`}
              disabled={working || line.quantity >= max}
              onClick={() => run(() => changeQuantity(line.variantId, line.quantity + 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Plus} size={16} />
            </button>
          </div>

          <button
            type="button"
            disabled={working}
            onClick={() => run(() => removeLine(line))}
            className="touch-target type-small text-fg underline decoration-gold underline-offset-4 hover:decoration-2 disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => run(() => saveLineForLater(line))}
            className="touch-target type-small text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg disabled:opacity-50"
          >
            Save for later
          </button>
        </div>
        {line.quantity >= max && !line.issue && line.maxQuantity > 0 && line.maxQuantity < 10 ? (
          <p className="type-small text-warning-text">Only {line.maxQuantity} left in this size.</p>
        ) : null}
      </div>
    </li>
  );
}
