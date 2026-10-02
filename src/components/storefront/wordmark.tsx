import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type WordmarkProps = Omit<ComponentProps<typeof Link>, 'href' | 'children'> & {
  /** Render as plain text (for example inside a link that already exists). */
  asText?: boolean;
};

/** AUREN: uppercase serif, 0.32em tracking. Extra props pass through, so it works with asChild. */
export function Wordmark({ className, asText = false, ...props }: WordmarkProps) {
  const classes = cn('type-wordmark text-h3 leading-none text-fg', className);
  if (asText) return <span className={classes}>AUREN</span>;
  return (
    <Link
      {...props}
      href="/"
      aria-label="AUREN home"
      className={cn(classes, 'inline-flex min-h-11 items-center')}
    >
      {/* The trailing tracking would push the word off-centre, so pull it back. */}
      <span className="-mr-(--tracking-wordmark)">AUREN</span>
    </Link>
  );
}
