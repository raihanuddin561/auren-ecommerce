'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuditFilterBarProps {
  entityTypes: string[];
  actions: string[];
  selectedEntityType?: string;
  selectedAction?: string;
}

export function AuditFilterBar({
  entityTypes,
  actions,
  selectedEntityType,
  selectedAction,
}: AuditFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleEntityChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set('entity', value);
    } else {
      params.delete('entity');
    }
    params.set('page', '1');
    router.push(`/admin/settings/audit?${params.toString()}`);
  };

  const handleActionChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set('action', value);
    } else {
      params.delete('action');
    }
    params.set('page', '1');
    router.push(`/admin/settings/audit?${params.toString()}`);
  };

  const handleReset = () => {
    router.push('/admin/settings/audit');
  };

  const hasActiveFilters = Boolean(selectedEntityType || selectedAction);

  return (
    <div className="flex flex-wrap items-center gap-3 border border-line bg-raised/50 p-4">
      <div className="w-56">
        <label className="mb-1 block type-caption text-fg-muted">Entity Type</label>
        <Select value={selectedEntityType ?? 'all'} onValueChange={handleEntityChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-64">
        <label className="mb-1 block type-caption text-fg-muted">Action</label>
        <Select value={selectedAction ?? 'all'} onValueChange={handleActionChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <div className="self-end pb-0.5">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
