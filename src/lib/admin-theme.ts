/**
 * Admin colour theme. The preference lives in localStorage; the inline script below applies it
 * before first paint so there is no flash. Pure helpers so the behaviour is unit tested.
 */

export type AdminTheme = 'light' | 'dark';

export const ADMIN_THEME_KEY = 'auren-admin-theme';
export const ADMIN_THEME_EVENT = 'auren-admin-theme-change';

/** A stored choice wins; otherwise follow the operating system. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): AdminTheme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Runs in the document head of admin pages. Must stay dependency free and never throw. */
export const ADMIN_THEME_INIT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem(${JSON.stringify(
  ADMIN_THEME_KEY,
)})}catch(e){}var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(d?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}})();`;

export function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(ADMIN_THEME_KEY);
  } catch {
    return null;
  }
}

export function currentTheme(): AdminTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Applies and remembers a theme, and tells subscribers. */
export function applyTheme(theme: AdminTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(ADMIN_THEME_KEY, theme);
  } catch {
    // Private mode: the choice applies for this page view only.
  }
  window.dispatchEvent(new Event(ADMIN_THEME_EVENT));
}
