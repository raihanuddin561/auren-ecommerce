import type { ReactNode } from 'react';
import { SidebarBrand, SidebarNav } from './sidebar';
import { Topbar, type ShellStaff } from './topbar';

/**
 * Admin chrome: sidebar (desktop) or drawer (mobile), top bar with the command palette, and the
 * content area. Dense and calm; light and dark follow the theme attribute on <html>.
 */
export function AdminShell({ staff, children }: { staff: ShellStaff; children: ReactNode }) {
  return (
    <div
      data-surface="admin"
      className="min-h-dvh bg-page type-admin text-fg lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]"
    >
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-fg focus:px-4 focus:py-3 focus:type-eyebrow focus:text-page"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-raised lg:flex">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav permissions={staff.permissions} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <Topbar staff={staff} />
        <main
          id="admin-main"
          className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
