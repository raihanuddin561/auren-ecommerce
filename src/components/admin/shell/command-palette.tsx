'use client';

import { Command } from 'cmdk';
import { CornerDownLeft, LogOut, Moon, Search, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { applyTheme } from '@/lib/admin-theme';
import { visibleAdminNav } from '@/lib/admin-nav';
import { signOutStaff } from '../sign-out';
import { useAdminTheme } from './theme';

const itemClass =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 type-admin text-fg data-[selected=true]:bg-sunken data-[selected=true]:outline-2 data-[selected=true]:-outline-offset-2 data-[selected=true]:outline-gold';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:type-eyebrow [&_[cmdk-group-heading]]:text-fg-muted';

const noopSubscribe = () => () => {};

/** "Ctrl" on Windows and Linux, the command symbol on macOS. */
export function useModifierLabel(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}

interface CommandPaletteProps {
  /** Element to focus again when the palette closes (the control that opened it). */
  returnFocusRef?: { current: HTMLElement | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: readonly string[];
}

/** Opens with ⌘K or Ctrl+K from anywhere in the console (the shell owns the shortcut). */
export function CommandPalette({
  open,
  onOpenChange,
  permissions,
  returnFocusRef,
}: CommandPaletteProps) {
  const router = useRouter();
  const theme = useAdminTheme();
  const groups = useMemo(
    () =>
      visibleAdminNav(permissions)
        .map((group) => ({ ...group, items: group.items.filter((item) => item.ready) }))
        .filter((group) => group.items.length > 0),
    [permissions],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const run = (action: () => void | Promise<void>) => {
    onOpenChange(false);
    void action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-describedby="command-palette-description"
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (!target?.isConnected) return;
          event.preventDefault();
          target.focus();
        }}
        className="top-24 max-w-xl -translate-y-0 overflow-hidden p-0 md:p-0"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription id="command-palette-description" className="sr-only">
          Type to jump to a screen or run an action. Use the arrow keys and Enter.
        </DialogDescription>
        <Command label="Search screens and actions" loop>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Icon icon={Search} className="text-fg-muted" />
            <Command.Input
              autoFocus
              placeholder="Search screens and actions"
              aria-label="Search screens and actions"
              className="h-14 flex-1 bg-transparent type-body text-fg outline-none placeholder:text-fg-muted"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center type-admin text-fg-muted">
              Nothing matches that yet.
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group.label} heading={group.label} className={groupClass}>
                {group.items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                    onSelect={() => run(() => router.push(item.href))}
                    className={itemClass}
                  >
                    <Icon icon={item.icon} size={18} className="text-fg-muted" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
            <Command.Group heading="Actions" className={groupClass}>
              <Command.Item
                value="Switch theme dark light appearance"
                onSelect={() => run(() => applyTheme(theme === 'dark' ? 'light' : 'dark'))}
                className={itemClass}
              >
                <Icon icon={theme === 'dark' ? Sun : Moon} size={18} className="text-fg-muted" />
                Switch to {theme === 'dark' ? 'light' : 'dark'} theme
              </Command.Item>
              <Command.Item
                value="Sign out log out"
                onSelect={() =>
                  run(async () => {
                    await signOutStaff(router);
                  })
                }
                className={itemClass}
              >
                <Icon icon={LogOut} size={18} className="text-fg-muted" />
                Sign out
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2.5 type-small text-fg-muted">
            <Icon icon={CornerDownLeft} size={14} />
            to select, Esc to close
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
