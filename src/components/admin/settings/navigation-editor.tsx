'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ExternalLink,
  Layers,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  saveNavigationSettingsAction,
  resetNavigationSettingsAction,
} from '@/modules/settings/actions';
import type {
  NavigationSettings,
  NavItemInput,
  NavColumnInput,
  NavLinkInput,
  MegaMenuTileInput,
} from '@/modules/settings/schemas';

interface NavigationEditorProps {
  initialSettings: NavigationSettings;
}

export function NavigationEditor({ initialSettings }: NavigationEditorProps) {
  const [items, setItems] = useState<NavItemInput[]>(initialSettings.items);
  const [editingIndex, setEditingIndex] = useState<number | null>(0);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reorder items
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[target]!;
    next[target] = temp!;
    setItems(next);
    if (editingIndex === index) setEditingIndex(target);
    else if (editingIndex === target) setEditingIndex(index);
  };

  // Add top-level item
  const addItem = () => {
    const newItem: NavItemInput = {
      label: `New Item ${items.length + 1}`,
      href: '/shop',
    };
    const next = [...items, newItem];
    setItems(next);
    setEditingIndex(next.length - 1);
  };

  // Remove top-level item
  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setMessage({ text: 'Navigation must have at least one menu item.', type: 'error' });
      return;
    }
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  // Update item fields
  const updateItem = (index: number, patch: Partial<NavItemInput>) => {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    setItems(next);
  };

  // Toggle mega menu for item
  const toggleMegaMenu = (index: number, enable: boolean) => {
    const item = items[index]!;
    if (enable) {
      updateItem(index, {
        columns: item.columns?.length
          ? item.columns
          : [
              {
                heading: 'Featured',
                links: [{ label: 'Shop All', href: '/shop' }],
              },
            ],
        tile: item.tile || {
          eyebrow: 'Curated',
          title: item.label,
          href: item.href,
          image: '/seed/sand.svg',
          imageAlt: item.label,
        },
      });
    } else {
      updateItem(index, { columns: undefined, tile: undefined });
    }
  };

  // Columns management
  const addColumn = (itemIndex: number) => {
    const item = items[itemIndex]!;
    const columns: NavColumnInput[] = [
      ...(item.columns || []),
      {
        heading: `Category ${(item.columns?.length || 0) + 1}`,
        links: [{ label: 'Explore', href: '/shop' }],
      },
    ];
    updateItem(itemIndex, { columns });
  };

  const removeColumn = (itemIndex: number, columnIndex: number) => {
    const item = items[itemIndex]!;
    const columns = (item.columns || []).filter((_, i) => i !== columnIndex);
    updateItem(itemIndex, { columns });
  };

  const updateColumnHeading = (itemIndex: number, columnIndex: number, heading: string) => {
    const item = items[itemIndex]!;
    const columns = [...(item.columns || [])];
    if (columns[columnIndex]) {
      columns[columnIndex] = { ...columns[columnIndex]!, heading };
      updateItem(itemIndex, { columns });
    }
  };

  // Links management inside column
  const addLink = (itemIndex: number, columnIndex: number) => {
    const item = items[itemIndex]!;
    const columns = [...(item.columns || [])];
    const column = columns[columnIndex];
    if (column) {
      column.links = [...column.links, { label: 'New Link', href: '/shop' }];
      updateItem(itemIndex, { columns });
    }
  };

  const removeLink = (itemIndex: number, columnIndex: number, linkIndex: number) => {
    const item = items[itemIndex]!;
    const columns = [...(item.columns || [])];
    const column = columns[columnIndex];
    if (column) {
      column.links = column.links.filter((_, i) => i !== linkIndex);
      updateItem(itemIndex, { columns });
    }
  };

  const updateLink = (
    itemIndex: number,
    columnIndex: number,
    linkIndex: number,
    patch: Partial<NavLinkInput>,
  ) => {
    const item = items[itemIndex]!;
    const columns = [...(item.columns || [])];
    const column = columns[columnIndex];
    if (column && column.links[linkIndex]) {
      column.links[linkIndex] = { ...column.links[linkIndex]!, ...patch };
      updateItem(itemIndex, { columns });
    }
  };

  // Tile management
  const updateTile = (itemIndex: number, patch: Partial<MegaMenuTileInput>) => {
    const item = items[itemIndex]!;
    const tile: MegaMenuTileInput = {
      eyebrow: '',
      title: '',
      href: '',
      image: '',
      imageAlt: '',
      ...(item.tile || {}),
      ...patch,
    };
    updateItem(itemIndex, { tile });
  };

  // Save action
  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveNavigationSettingsAction({ items });
      if (res.ok) {
        setMessage({ text: 'Storefront navigation saved successfully!', type: 'success' });
      } else {
        setMessage({ text: res.error.message || 'Failed to save navigation.', type: 'error' });
      }
    });
  };

  // Reset action
  const handleReset = () => {
    if (
      !window.confirm(
        'Reset navigation menu back to default luxury menswear categories? Any custom menu items will be overwritten.',
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await resetNavigationSettingsAction();
      if (res.ok) {
        window.location.reload();
      } else {
        setMessage({ text: res.error.message || 'Failed to reset navigation.', type: 'error' });
      }
    });
  };

  const currentItem = editingIndex !== null ? items[editingIndex] : null;

  return (
    <div className="space-y-6">
      {/* Action Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-sm border border-line bg-raised p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-fg">Storefront Navigation Management</h2>
          <p className="text-xs text-fg-muted">
            Configure primary desktop mega-menu items, mobile navigation drawers, and featured promo
            tiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={isPending}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="gap-1.5 bg-ink text-xs text-ivory hover:bg-ink/90"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-sm border p-3 text-xs ${
            message.type === 'success'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <span className="font-bold">!</span>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Live Storefront Menu Bar Preview */}
      <div className="rounded-sm border border-line bg-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="type-eyebrow text-fg-muted">Storefront Header Preview</span>
          <span className="text-xs text-fg-muted">Real-time simulation</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 rounded-sm border border-line/60 bg-page px-6 py-3">
          <div className="font-serif text-sm font-semibold tracking-wider text-fg uppercase">
            AUREN
          </div>
          <div className="h-4 w-px bg-line" />
          <nav className="flex flex-wrap items-center gap-6 text-xs font-medium tracking-wider uppercase">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEditingIndex(idx)}
                className={`transition-colors hover:text-gold ${
                  editingIndex === idx
                    ? 'border-b-2 border-gold font-semibold text-fg'
                    : 'text-fg-muted'
                }`}
              >
                {item.label}
                {item.columns && item.columns.length > 0 && (
                  <ChevronDown className="ml-1 inline h-3 w-3 opacity-60" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main 2-Col Layout: Left items list, Right active item configuration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Reorderable Items List */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg">Top-Level Menu Items</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addItem}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const isSelected = editingIndex === idx;
              const hasMegaMenu = Boolean(item.columns?.length);

              return (
                <div
                  key={idx}
                  onClick={() => setEditingIndex(idx)}
                  className={`cursor-pointer rounded-sm border p-3 transition-all ${
                    isSelected
                      ? 'shadow-xs border-gold bg-raised'
                      : 'border-line bg-raised hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-page type-caption font-mono text-fg-muted">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="truncate text-xs font-semibold text-fg">{item.label}</div>
                        <div className="truncate type-caption font-mono text-fg-muted">
                          {item.href}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={hasMegaMenu ? 'gold' : 'neutral'} className="type-caption">
                        {hasMegaMenu ? `${item.columns?.length} cols` : 'Direct'}
                      </Badge>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(idx, 'up');
                        }}
                        className="p-1 text-fg-muted hover:text-fg disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(idx, 'down');
                        }}
                        className="p-1 text-fg-muted hover:text-fg disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(idx);
                        }}
                        className="p-1 text-fg-muted hover:text-danger-text"
                        title="Delete Item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Menu Item Inspector & Mega-Menu Config */}
        <div className="space-y-5 lg:col-span-2">
          {currentItem && editingIndex !== null ? (
            <div className="space-y-6 rounded-sm border border-line bg-raised p-5">
              <div className="border-b border-line pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-fg">
                      Configuring: {currentItem.label}
                    </h3>
                    <p className="text-xs text-fg-muted">
                      Control destination link, dropdown columns, and promotional feature cards.
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-fg-muted hover:text-fg"
                  >
                    <Link href={currentItem.href} target="_blank">
                      <ExternalLink className="h-3 w-3" />
                      Test URL
                    </Link>
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="itemLabel" className="text-xs text-fg-muted">
                      Display Label *
                    </Label>
                    <Input
                      id="itemLabel"
                      value={currentItem.label}
                      onChange={(e) => updateItem(editingIndex, { label: e.target.value })}
                      placeholder="e.g. Collections"
                      className="h-9 border-line bg-page text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="itemHref" className="text-xs text-fg-muted">
                      Primary Destination URL *
                    </Label>
                    <Input
                      id="itemHref"
                      value={currentItem.href}
                      onChange={(e) => updateItem(editingIndex, { href: e.target.value })}
                      placeholder="e.g. /collections"
                      className="h-9 border-line bg-page font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableMegaMenu"
                    checked={Boolean(currentItem.columns?.length)}
                    onChange={(e) => toggleMegaMenu(editingIndex, e.target.checked)}
                    className="h-4 w-4 rounded-xs border-line text-gold focus:ring-gold"
                  />
                  <Label
                    htmlFor="enableMegaMenu"
                    className="cursor-pointer text-xs font-medium text-fg"
                  >
                    Enable Mega Menu Dropdown Panel (Show category columns & featured promo tile)
                  </Label>
                </div>
              </div>

              {/* Mega Menu Columns Section */}
              {currentItem.columns && currentItem.columns.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-gold" />
                      <h4 className="text-xs font-semibold text-fg">Mega Menu Columns</h4>
                      <span className="text-xs text-fg-muted">
                        ({currentItem.columns.length} columns)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addColumn(editingIndex)}
                      className="h-7 gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Add Column
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {currentItem.columns.map((column, colIdx) => (
                      <div
                        key={colIdx}
                        className="space-y-3 rounded-sm border border-line bg-page/40 p-4"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                          <Input
                            value={column.heading}
                            onChange={(e) =>
                              updateColumnHeading(editingIndex, colIdx, e.target.value)
                            }
                            placeholder="Column Heading"
                            className="h-7 border-line bg-page text-xs font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => removeColumn(editingIndex, colIdx)}
                            className="p-1 text-fg-muted hover:text-danger-text"
                            title="Delete Column"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Sub links inside column */}
                        <div className="space-y-2">
                          {column.links.map((link, linkIdx) => (
                            <div key={linkIdx} className="flex items-center gap-2">
                              <Input
                                value={link.label}
                                onChange={(e) =>
                                  updateLink(editingIndex, colIdx, linkIdx, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="Link Label"
                                className="h-7 flex-1 border-line bg-page text-xs"
                              />
                              <Input
                                value={link.href}
                                onChange={(e) =>
                                  updateLink(editingIndex, colIdx, linkIdx, {
                                    href: e.target.value,
                                  })
                                }
                                placeholder="/shop/category"
                                className="h-7 flex-1 border-line bg-page type-caption font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => removeLink(editingIndex, colIdx, linkIdx)}
                                className="p-1 text-fg-muted hover:text-danger-text"
                                title="Remove Link"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addLink(editingIndex, colIdx)}
                          className="h-6 w-full type-caption text-fg-muted hover:text-fg"
                        >
                          + Add Sub-Link
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Mega Menu Featured Tile Section */}
                  <div className="space-y-3 border-t border-line pt-4">
                    <span className="block text-xs font-semibold text-fg">
                      Promotional Featured Tile (Right side of Mega Menu)
                    </span>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="type-caption text-fg-muted">Eyebrow / Badge</Label>
                        <Input
                          value={currentItem.tile?.eyebrow || ''}
                          onChange={(e) => updateTile(editingIndex, { eyebrow: e.target.value })}
                          placeholder="e.g. The Edit"
                          className="h-8 border-line bg-page text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="type-caption text-fg-muted">Headline / Title</Label>
                        <Input
                          value={currentItem.tile?.title || ''}
                          onChange={(e) => updateTile(editingIndex, { title: e.target.value })}
                          placeholder="e.g. Winter Layers"
                          className="h-8 border-line bg-page text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="type-caption text-fg-muted">Destination Link</Label>
                        <Input
                          value={currentItem.tile?.href || ''}
                          onChange={(e) => updateTile(editingIndex, { href: e.target.value })}
                          placeholder="/collections/winter-layers"
                          className="h-8 border-line bg-page font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="type-caption text-fg-muted">Image URL</Label>
                        <Input
                          value={currentItem.tile?.image || ''}
                          onChange={(e) => updateTile(editingIndex, { image: e.target.value })}
                          placeholder="/seed/sand.svg or https://..."
                          className="h-8 border-line bg-page font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 rounded-sm border border-dashed border-line bg-page/30 p-12 text-center">
              <Menu className="h-8 w-8 text-fg-muted/40" />
              <p className="text-xs font-medium text-fg">Select a menu item to configure</p>
              <p className="text-xs text-fg-muted">
                Choose an item from the list on the left to edit its destinations and mega-menu
                columns.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
