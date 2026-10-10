'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createLookbookAction } from '@/modules/lookbook/actions';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateLookbookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [season, setSeason] = useState('AW 2026');
  const [heroImage, setHeroImage] = useState('/editorial/lookbook.jpg');
  const [description, setDescription] = useState('');

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === toSlug(title)) {
      setSlug(toSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await createLookbookAction({
        title,
        slug,
        season,
        heroImage,
        description: description || undefined,
        status: 'draft',
      });

      if (!res.ok) {
        setError(res.error.message || 'Failed to create lookbook');
        return;
      }

      setOpen(false);
      router.push(`/admin/lookbooks/${res.data.id}`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus size={14} />
          <span>New Lookbook</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="type-title-md font-serif">Create Seasonal Lookbook</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xs border border-danger/40 bg-danger/10 p-3 type-caption text-danger">
              {error}
            </div>
          )}

          <div>
            <label className="block type-caption font-medium text-fg">Lookbook Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Autumn / Winter 2026: Noble Textures"
              className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block type-caption font-medium text-fg">URL Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(toSlug(e.target.value))}
                placeholder="autumn-winter-2026"
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block type-caption font-medium text-fg">Season / Year *</label>
              <input
                type="text"
                required
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="AW 2026"
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block type-caption font-medium text-fg">Cover Hero Image URL *</label>
            <input
              type="text"
              required
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              placeholder="https://... or /editorial/lookbook.jpg"
              className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block type-caption font-medium text-fg">Curatorial Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief editorial overview of noble fibers, silhouettes, and theme..."
              className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create & Open Studio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
