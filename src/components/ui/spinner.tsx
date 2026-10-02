import { cn } from '@/lib/cn';

interface SpinnerProps {
  /** Accessible label. Omit when the surrounding control already says what is happening. */
  label?: string;
  className?: string;
}

/** Rare by design: prefer skeletons that match the final layout. */
export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex size-4 items-center justify-center', className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-full animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
