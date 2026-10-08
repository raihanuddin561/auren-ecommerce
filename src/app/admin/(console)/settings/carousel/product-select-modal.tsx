'use client';

import { Check, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { searchProductsForPicker } from '@/modules/catalog/actions';

export interface SelectedProductData {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  imageUrl: string | null;
}

interface ProductSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (product: SelectedProductData) => void;
  title?: string;
  description?: string;
}

export function ProductSelectModal({
  open,
  onOpenChange,
  onSelectProduct,
  title = 'Select Product for Carousel',
  description = 'Choose any recorded store piece to automatically apply its photography, name, and shopping link to the carousel.',
}: ProductSelectModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<
    Array<{
      id: string;
      title: string;
      slug: string;
      subtitle: string | null;
      status: string;
      imageUrl: string | null;
    }>
  >([]);

  // Load products when modal opens or query changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchProductsForPicker({ q: query, excludeIds: [] });
        if (!cancelled && res.ok) {
          setProducts(res.data);
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative mt-4">
          <Icon
            icon={Search}
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by piece title, slug, or style..."
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Products list */}
        <div className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 border border-line p-2.5">
                  <Skeleton className="size-14 shrink-0 rounded-xs" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xs border border-line/60 bg-sunken/40 py-10 text-center">
              <p className="type-body text-fg">No products found</p>
              <p className="mt-1 type-small text-fg-muted">
                {query ? `No items matching "${query}"` : 'No products available in the catalog.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {products.map((product) => {
                const img = product.imageUrl;
                return (
                  <div
                    key={product.id}
                    className="group hover:bg-surface-raised/40 flex items-center justify-between gap-3 rounded-xs border border-line bg-page p-2.5 transition-all hover:border-gold"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Product Thumbnail */}
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xs border border-line bg-sunken">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={product.title}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[10px] text-fg-muted">
                            No photo
                          </div>
                        )}
                      </div>

                      {/* Product details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate type-body font-medium text-fg">{product.title}</p>
                          <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>
                            {product.status}
                          </Badge>
                        </div>
                        <p className="type-caption truncate text-accent-text">
                          /products/{product.slug}
                        </p>
                        {product.subtitle ? (
                          <p className="truncate type-small text-fg-muted">{product.subtitle}</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Action */}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0 transition-colors group-hover:border-fg"
                      onClick={() => {
                        onSelectProduct({
                          id: product.id,
                          title: product.title,
                          slug: product.slug,
                          subtitle: product.subtitle,
                          imageUrl: product.imageUrl,
                        });
                        onOpenChange(false);
                      }}
                    >
                      <Icon icon={Check} size={14} className="mr-1" />
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
