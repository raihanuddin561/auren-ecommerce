'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import {
  ADMIN_THEME_EVENT,
  applyTheme,
  currentTheme,
  readStoredTheme,
  resolveTheme,
  type AdminTheme,
} from '@/lib/admin-theme';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ADMIN_THEME_EVENT, onChange);
  return () => window.removeEventListener(ADMIN_THEME_EVENT, onChange);
}

export function useAdminTheme(): AdminTheme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}

/**
 * Keeps the theme attribute on <html> (so portalled dialogs and menus follow it) while admin
 * screens are mounted, and removes it again for the storefront.
 */
export function AdminThemeScope() {
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = resolveTheme(readStoredTheme(), dark);
    window.dispatchEvent(new Event(ADMIN_THEME_EVENT));
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);
  return null;
}

export function ThemeToggle() {
  const theme = useAdminTheme();
  const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip content={`Switch to ${next} theme`}>
      <IconButton aria-label={`Switch to ${next} theme`} onClick={() => applyTheme(next)}>
        <Icon icon={theme === 'dark' ? Sun : Moon} />
      </IconButton>
    </Tooltip>
  );
}
