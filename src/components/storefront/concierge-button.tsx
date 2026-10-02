'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { clientEnv } from '@/lib/env.client';
import { conciergeHref, hidesConcierge } from '@/lib/site';

/**
 * Floating WhatsApp concierge, bottom-right and deliberately quiet. Hidden on checkout. Falls
 * back to the contact page when no WhatsApp number is configured.
 */
export function ConciergeButton() {
  const pathname = usePathname();
  if (hidesConcierge(pathname)) return null;

  const href = conciergeHref(clientEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  const external = href.startsWith('https://');

  return (
    <div className="fixed right-4 bottom-4 z-30 md:right-6 md:bottom-6">
      <Tooltip content="Speak to our concierge" side="left">
        <a
          href={href}
          aria-label="Speak to our concierge"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="inline-flex size-12 items-center justify-center rounded-sm border border-line bg-raised text-fg shadow-float transition-auren hover:border-gold hover:text-accent-text"
        >
          <Icon icon={MessageCircle} />
        </a>
      </Tooltip>
    </div>
  );
}
