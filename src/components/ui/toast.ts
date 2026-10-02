import { toast as raise } from 'sonner';

/**
 * Toast API for client components. Messages are short and calm, never exclamatory.
 * Destructive actions that can be reversed pass an `undo` handler, which becomes an action button.
 */
export const toast = {
  message(title: string, description?: string) {
    return raise(title, { description });
  },
  success(title: string, description?: string) {
    return raise.success(title, { description });
  },
  error(title: string, description?: string) {
    return raise.error(title, { description, duration: 8000 });
  },
  warning(title: string, description?: string) {
    return raise.warning(title, { description });
  },
  /** For example `toast.undoable('Removed from your bag', () => restore())`. */
  undoable(title: string, undo: () => void, description?: string) {
    return raise(title, {
      description,
      duration: 8000,
      action: { label: 'Undo', onClick: undo },
    });
  },
  dismiss: raise.dismiss,
};
