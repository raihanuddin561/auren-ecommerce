import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from '@/components/ui/icon';
import { fieldControlClasses } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  children: ReactNode;
}

/**
 * A native select (best on phones: the system picker) in the same box as the other fields. Used for
 * the cascading address pickers, where lists are long and a native control is faster to scan.
 */
export function NativeSelect({ className, invalid, children, ...props }: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          fieldControlClasses,
          'h-12 appearance-none pr-11 type-body disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        size={18}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}
