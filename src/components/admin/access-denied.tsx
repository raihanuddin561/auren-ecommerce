import { ShieldAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

/** Shown to signed-in people who are not active staff. Rendered by the console layout. */
export function AccessDenied() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <Icon icon={ShieldAlert} size={28} className="text-fg-muted" />
      <h1 className="type-h2 font-sans font-medium text-fg">You do not have access to this area</h1>
      <p className="type-admin text-fg-muted">
        Ask the store owner to grant your account the right role.
      </p>
    </main>
  );
}
