'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye, ShieldCheck, UserCheck } from 'lucide-react';
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
import type { AuditLogListItem } from '@/modules/audit/types';

interface AuditLogTableProps {
  logs: AuditLogListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  baseUrl: string;
}

function getActionTone(action: string): 'success' | 'warning' | 'gold' | 'neutral' {
  if (action.includes('create') || action.includes('confirm') || action.includes('verify')) {
    return 'success';
  }
  if (action.includes('delete') || action.includes('cancel') || action.includes('revoke')) {
    return 'warning';
  }
  if (action.includes('update') || action.includes('edit') || action.includes('role')) {
    return 'gold';
  }
  return 'neutral';
}

function formatDhakaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function AuditLogTable({ logs, totalCount, page, totalPages, baseUrl }: AuditLogTableProps) {
  const [inspectingItem, setInspectingItem] = useState<AuditLogListItem | null>(null);

  if (logs.length === 0) {
    return (
      <div className="border border-line bg-page p-12 text-center">
        <p className="type-h3 text-fg">No audit records found</p>
        <p className="mt-1 type-admin text-fg-muted">
          No administrative events match the selected criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto border border-line bg-page">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-raised type-eyebrow text-fg-muted">
            <tr>
              <th className="px-4 py-3">Timestamp (Dhaka)</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3 text-right">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.map((item) => {
              const hasPayload = item.before !== null || item.after !== null;
              return (
                <tr key={item.id} className="transition-colors hover:bg-raised/50">
                  <td className="type-body-xs px-4 py-3 font-mono whitespace-nowrap text-fg-muted">
                    {formatDhakaDate(item.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    {item.actorName ? (
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 font-medium text-fg">
                          <Icon icon={UserCheck} size={14} className="text-accent-text" />
                          <span>{item.actorName}</span>
                        </span>
                        <span className="type-caption text-fg-muted">{item.actorEmail}</span>
                      </div>
                    ) : item.actorId ? (
                      <span className="type-caption inline-block max-w-[140px] truncate font-mono text-fg-muted">
                        {item.actorId}
                      </span>
                    ) : (
                      <span className="type-caption text-fg-subtle inline-flex items-center gap-1 italic">
                        <Icon icon={ShieldCheck} size={13} />
                        System Job
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Badge tone={getActionTone(item.action)}>{item.action}</Badge>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="type-caption font-medium tracking-wider text-fg uppercase">
                        {item.entityType}
                      </span>
                      <span className="type-caption max-w-[140px] truncate font-mono text-fg-muted">
                        {item.entityId}
                      </span>
                    </div>
                  </td>

                  <td className="type-body-xs px-4 py-3 font-mono text-fg-muted">
                    {item.ip ?? '—'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {hasPayload ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInspectingItem(item)}
                        className="gap-1.5"
                      >
                        <Icon icon={Eye} size={13} />
                        <span>Inspect</span>
                      </Button>
                    ) : (
                      <span className="type-caption text-fg-muted italic">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between border border-line bg-raised/30 px-4 py-3">
        <span className="type-caption text-fg-muted">
          Showing {logs.length} of {totalCount} total audit entries (Page {page} of {totalPages})
        </span>

        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`${baseUrl}?page=${page - 1}`} className="gap-1">
                <Icon icon={ChevronLeft} size={14} />
                <span>Previous</span>
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled className="gap-1">
              <Icon icon={ChevronLeft} size={14} />
              <span>Previous</span>
            </Button>
          )}

          {page < totalPages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`${baseUrl}?page=${page + 1}`} className="gap-1">
                <span>Next</span>
                <Icon icon={ChevronRight} size={14} />
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled className="gap-1">
              <span>Next</span>
              <Icon icon={ChevronRight} size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Payload Inspection Modal */}
      <Dialog
        open={inspectingItem !== null}
        onOpenChange={(open) => !open && setInspectingItem(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Payload Inspection</DialogTitle>
            <DialogDescription>
              {inspectingItem ? (
                <span>
                  Action: <strong>{inspectingItem.action}</strong> on{' '}
                  <strong>{inspectingItem.entityType}</strong> ({inspectingItem.entityId})
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {inspectingItem ? (
            <div className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              {inspectingItem.before ? (
                <div className="flex flex-col gap-1.5">
                  <span className="type-caption font-semibold tracking-wider text-fg-muted uppercase">
                    State Before Modification
                  </span>
                  <pre className="rounded type-caption overflow-x-auto border border-line bg-sunken p-3 font-mono text-fg">
                    {JSON.stringify(inspectingItem.before, null, 2)}
                  </pre>
                </div>
              ) : null}

              {inspectingItem.after ? (
                <div className="flex flex-col gap-1.5">
                  <span className="type-caption font-semibold tracking-wider text-fg-muted uppercase">
                    State After Modification
                  </span>
                  <pre className="rounded type-caption overflow-x-auto border border-line bg-sunken p-3 font-mono text-fg">
                    {JSON.stringify(inspectingItem.after, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
