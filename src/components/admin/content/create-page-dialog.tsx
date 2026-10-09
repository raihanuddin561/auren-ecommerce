'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPageAction } from '@/modules/content/actions';
import type { PageStatus } from '@/modules/content/types';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function CreatePageDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PageStatus>('draft');

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast.error('Title and slug are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPageAction({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        status,
      });

      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to create page');
        return;
      }

      toast.success('Page created successfully');
      setOpen(false);
      setTitle('');
      setSlug('');
      setDescription('');
      router.push(`/admin/content/${res.data.id}`);
    } catch {
      toast.error('Unexpected error creating page');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="text-canvas gap-1.5 bg-ink text-xs hover:bg-ink/90">
          <Plus className="h-3.5 w-3.5" />
          Create Page
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-canvas max-w-md border-line">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold text-ink">
            Create Landing Page
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pageTitle" className="text-stone text-xs">
              Page Title *
            </Label>
            <Input
              id="pageTitle"
              placeholder="e.g. The Sartorial Story"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-surface h-9 border-line text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pageSlug" className="text-stone text-xs">
              URL Slug *
            </Label>
            <div className="text-stone bg-surface flex items-center gap-1.5 rounded-sm border border-line px-2.5 font-mono text-xs">
              <span>/pages/</span>
              <Input
                id="pageSlug"
                placeholder="sartorial-story"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-8 border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:ring-0"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pageDesc" className="text-stone text-xs">
              Summary / Excerpt
            </Label>
            <Textarea
              id="pageDesc"
              placeholder="Short description of this editorial page..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface min-h-[70px] border-line text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pageStatus" className="text-stone text-xs">
              Initial Status
            </Label>
            <select
              id="pageStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as PageStatus)}
              className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
            >
              <option value="draft">Draft (Private)</option>
              <option value="published">Published (Live)</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-line text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-canvas bg-ink text-xs hover:bg-ink/90"
            >
              {isSubmitting ? 'Creating...' : 'Create & Design'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
