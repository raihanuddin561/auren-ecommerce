'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

export interface SortableItem {
  id: string;
  /** Plain-text name used in the button labels ("Move Oxford Shirt earlier"). */
  label: string;
  content: ReactNode;
}

interface SortableListProps {
  items: SortableItem[];
  /** Called with the new order of ids. Reject or return false to put the list back. */
  onReorder: (orderedIds: string[]) => Promise<boolean | void> | boolean | void;
  /** Accessible name of the list. */
  label: string;
  disabled?: boolean;
  className?: string;
  /** `grid` lays items out as a responsive grid (images), `list` stacks them (rows). */
  layout?: 'list' | 'grid';
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item !== undefined) copy.splice(to, 0, item);
  return copy;
}

/**
 * Reorderable list. Mouse users drag an item; keyboard and screen reader users use the earlier and
 * later buttons, which work everywhere (drag and drop alone is not accessible). The new order is
 * shown at once and put back if the server refuses it.
 */
export function SortableList({
  items,
  onReorder,
  label,
  disabled,
  className,
  layout = 'list',
}: SortableListProps) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const incoming = items.map((i) => i.id).join('|');
  const previous = useRef(incoming);
  const latest = useRef(order);

  // Server data changed (after a refresh): follow it.
  useEffect(() => {
    if (previous.current !== incoming) {
      previous.current = incoming;
      const fresh = incoming ? incoming.split('|') : [];
      latest.current = fresh;
      setOrder(fresh);
    }
  }, [incoming]);

  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order.filter((id) => byId.has(id));

  async function commit(next: string[], moved: string, position: number) {
    const before = latest.current;
    latest.current = next;
    setOrder(next);
    setAnnouncement(
      `${byId.get(moved)?.label ?? 'Item'} moved to position ${position + 1} of ${next.length}`,
    );
    try {
      const accepted = await onReorder(next);
      if (accepted === false && latest.current === next) {
        latest.current = before;
        setOrder(before);
      }
    } catch {
      if (latest.current === next) {
        latest.current = before;
        setOrder(before);
      }
    }
  }

  return (
    <>
      <ol
        aria-label={label}
        className={cn(
          layout === 'grid'
            ? 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'
            : 'flex flex-col gap-2',
          className,
        )}
      >
        {shown.map((id, index) => {
          const item = byId.get(id)!;
          return (
            <li
              key={id}
              onDragOver={(event) => {
                if (dragging && dragging !== id) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragging || dragging === id) return;
                const from = shown.indexOf(dragging);
                void commit(move(shown, from, index), dragging, index);
                setDragging(null);
              }}
              className={cn(
                'flex items-stretch gap-2 border border-line bg-raised',
                layout === 'grid' ? 'flex-col' : '',
                dragging === id && 'opacity-50',
              )}
            >
              <div className={cn('min-w-0 flex-1', layout === 'list' && 'p-3')}>{item.content}</div>
              <div
                className={cn(
                  'flex items-center gap-1',
                  layout === 'grid' ? 'border-t border-line p-1' : 'border-l border-line p-1',
                )}
              >
                {/* Only the handle drags: text fields inside an item stay selectable. */}
                <span
                  aria-hidden="true"
                  draggable={!disabled}
                  onDragStart={(event) => {
                    setDragging(id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', id);
                    const row = event.currentTarget.closest('li');
                    if (row) event.dataTransfer.setDragImage(row, 16, 16);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab px-1 text-fg-muted"
                >
                  <Icon icon={GripVertical} size={18} />
                </span>
                <button
                  type="button"
                  aria-label={`Move ${item.label} earlier`}
                  disabled={disabled || index === 0}
                  onClick={() => void commit(move(shown, index, index - 1), id, index - 1)}
                  className="inline-flex size-9 items-center justify-center text-fg hover:bg-fg/8 disabled:opacity-30"
                >
                  <Icon icon={ArrowUp} size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.label} later`}
                  disabled={disabled || index === shown.length - 1}
                  onClick={() => void commit(move(shown, index, index + 1), id, index + 1)}
                  className="inline-flex size-9 items-center justify-center text-fg hover:bg-fg/8 disabled:opacity-30"
                >
                  <Icon icon={ArrowDown} size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
