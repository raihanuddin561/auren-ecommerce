'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'auren_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Delay display slightly for smooth page entrance
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access may be restricted; ignore
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, 'all');
    } catch {}
    setVisible(false);
  }

  function handleDecline() {
    try {
      localStorage.setItem(STORAGE_KEY, 'essential');
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie Preferences"
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-xl animate-fade-in rounded-xs border border-line bg-page/95 p-5 shadow-float backdrop-blur-md transition-all sm:right-auto sm:bottom-6 sm:left-6"
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="type-eyebrow text-accent-text">PRIVACY PREFERENCES</span>
          <p className="mt-1.5 type-small text-pretty text-fg-muted">
            We use essential cookies to secure your session, preserve your shopping bag, and deliver
            an effortless bespoke experience. Review our{' '}
            <a href="/privacy" className="text-fg underline hover:text-gold">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={handleAccept} className="px-4 type-small">
            Accept All
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDecline} className="px-4 type-small">
            Essential Only
          </Button>
        </div>
      </div>
    </div>
  );
}
