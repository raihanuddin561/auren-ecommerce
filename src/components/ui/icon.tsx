import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface IconProps {
  icon: LucideIcon;
  /** Pixel size; the default 20 matches the design system. */
  size?: number;
  className?: string;
}

/** Lucide at the brand weight (1.25 stroke), decorative by default. */
export function Icon({ icon: Glyph, size = 20, className }: IconProps) {
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      strokeWidth={1.25}
      className={cn('shrink-0', className)}
    />
  );
}
