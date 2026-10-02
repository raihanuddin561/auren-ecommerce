'use client';

import { Menu, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { CommandPalette, useModifierLabel } from './command-palette';
import { SidebarBrand, SidebarNav } from './sidebar';
import { ThemeToggle } from './theme';

export interface ShellStaff {
  name: string;
  email: string;
  role: string;
  permissions: readonly string[];
}

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

export function Topbar({ staff }: { staff: ShellStaff }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const changePalette = (open: boolean) => {
    // Remember what had focus so Escape puts it back, whether opened by click or by shortcut.
    if (open && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setPaletteOpen(open);
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const modifier = useModifierLabel();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-page px-3 md:px-6">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <IconButton aria-label="Open navigation" className="lg:hidden">
            <Icon icon={Menu} />
          </IconButton>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 bg-raised"
          aria-describedby="admin-drawer-description"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription id="admin-drawer-description" className="sr-only">
            Admin sections
          </SheetDescription>
          <SidebarBrand />
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav permissions={staff.permissions} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => changePalette(true)}
        aria-label="Open command palette"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-sm border border-line-strong bg-raised px-3 text-left type-admin text-fg-muted transition-auren-fast hover:border-fg/60 md:w-96 md:flex-none"
      >
        <Icon icon={Search} size={16} />
        <span className="flex-1 truncate">Search or jump to</span>
        <kbd className="hidden rounded-xs border border-line-strong px-1.5 py-0.5 type-eyebrow tracking-normal text-fg-muted normal-case md:inline">
          {modifier} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex size-11 items-center justify-center rounded-sm hover:bg-fg/8"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center bg-fg type-eyebrow tracking-normal text-page"
              >
                {initials(staff.name)}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="type-admin font-medium text-fg">{staff.name}</p>
            <p className="truncate type-small text-fg-muted">{staff.email}</p>
            <p className="mt-1 type-small text-fg-muted capitalize">
              {staff.role.replaceAll('_', ' ')}
            </p>
            <div className="mt-3 border-t border-line pt-2">
              <SignOutButton />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={changePalette}
        permissions={staff.permissions}
        returnFocusRef={returnFocusRef}
      />
    </header>
  );
}
