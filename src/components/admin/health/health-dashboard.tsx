'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Mail,
  Send,
  Server,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import type { SystemHealthData } from '@/modules/settings/types';

interface HealthDashboardProps {
  data: SystemHealthData;
}

export function HealthDashboard({ data }: HealthDashboardProps) {
  const isHealthy = data.overallStatus === 'healthy';
  const isDegraded = data.overallStatus === 'degraded';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div
        className={`flex items-center justify-between border p-5 ${
          isHealthy
            ? 'border-success/30 bg-success/5'
            : isDegraded
              ? 'border-warning/30 bg-warning/5'
              : 'border-danger/30 bg-danger/5'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon
            icon={isHealthy ? CheckCircle2 : isDegraded ? AlertTriangle : XCircle}
            className={`size-6 ${
              isHealthy ? 'text-success' : isDegraded ? 'text-warning-text' : 'text-danger'
            }`}
          />
          <div className="flex flex-col">
            <span className="type-h3 text-fg">
              {isHealthy
                ? 'All Systems Operational'
                : isDegraded
                  ? 'System Degraded'
                  : 'Critical Attention Required'}
            </span>
            <span className="type-caption text-fg-muted">
              Dhaka Server Time: {data.environment.serverTimeDhaka} • Environment:{' '}
              {data.environment.nodeEnv}
            </span>
          </div>
        </div>

        <Badge
          tone={isHealthy ? 'success' : isDegraded ? 'warning' : 'danger'}
          className="tracking-wider uppercase"
        >
          {data.overallStatus}
        </Badge>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Database Metric */}
        <div className="flex flex-col gap-3 border border-line bg-raised p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 type-eyebrow text-fg-muted">
              <Icon icon={Database} size={15} />
              <span>Core Database</span>
            </span>
            <Badge tone={data.database.status === 'connected' ? 'success' : 'danger'}>
              {data.database.status}
            </Badge>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="type-display-sm font-mono text-fg">
              {data.database.latencyMs >= 0 ? `${data.database.latencyMs}ms` : 'Timeout'}
            </span>
            <span className="type-caption text-fg-muted">round-trip ping</span>
          </div>

          <p className="mt-auto border-t border-line/60 pt-2 type-caption text-fg-subtle">
            Direct connection via PostgreSQL driver
          </p>
        </div>

        {/* Outbox Pipeline */}
        <div className="flex flex-col gap-3 border border-line bg-raised p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 type-eyebrow text-fg-muted">
              <Icon icon={Send} size={15} />
              <span>Domain Outbox Queue</span>
            </span>
            <Badge tone={data.outbox.failed > 0 ? 'warning' : 'success'}>
              {data.outbox.failed > 0 ? `${data.outbox.failed} failed` : 'Healthy'}
            </Badge>
          </div>

          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="type-display-sm font-mono text-fg">{data.outbox.pending}</span>
              <span className="block type-caption text-fg-muted">pending</span>
            </div>
            <div>
              <span className="type-display-sm font-mono text-fg">{data.outbox.dispatched}</span>
              <span className="block type-caption text-fg-muted">dispatched</span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-line/60 pt-2 type-caption text-fg-subtle">
            <span>Oldest Pending:</span>
            <span>
              {data.outbox.oldestPendingAgeMinutes !== null
                ? `${data.outbox.oldestPendingAgeMinutes} min ago`
                : 'Queue Empty'}
            </span>
          </div>
        </div>

        {/* Processed Inbox / Idempotency */}
        <div className="flex flex-col gap-3 border border-line bg-raised p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 type-eyebrow text-fg-muted">
              <Icon icon={Server} size={15} />
              <span>Idempotency Inbox</span>
            </span>
            <Badge tone="neutral">Active</Badge>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="type-display-sm font-mono text-fg">
              {data.inbox.processedCount.toLocaleString()}
            </span>
            <span className="type-caption text-fg-muted">deduplicated events</span>
          </div>

          <p className="mt-auto border-t border-line/60 pt-2 type-caption text-fg-subtle">
            Guarantees zero double-sends for orders & emails
          </p>
        </div>
      </div>

      {/* Subsystems & Integrations Table */}
      <div className="border border-line bg-page">
        <div className="border-b border-line bg-raised px-5 py-3">
          <h2 className="type-h3 text-fg">External Integrations & Subsystems</h2>
        </div>

        <div className="divide-y divide-line">
          {/* Email Service */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon icon={Mail} size={18} className="text-fg-muted" />
              <div>
                <p className="type-admin font-medium text-fg">Transactional Email</p>
                <p className="type-caption text-fg-muted">
                  Provider: {data.services.emailProvider}
                </p>
              </div>
            </div>
            <Badge tone={data.services.emailConfigured ? 'success' : 'neutral'}>
              {data.services.emailConfigured ? 'Configured' : 'Dev Fallback'}
            </Badge>
          </div>

          {/* Media & Storage */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon icon={HardDrive} size={18} className="text-fg-muted" />
              <div>
                <p className="type-admin font-medium text-fg">Media Storage</p>
                <p className="type-caption text-fg-muted">
                  Provider: {data.services.storageProvider}
                </p>
              </div>
            </div>
            <Badge tone={data.services.storageProvider === 'Vercel Blob' ? 'success' : 'neutral'}>
              {data.services.storageProvider}
            </Badge>
          </div>

          {/* Background Jobs / Inngest */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon icon={Zap} size={18} className="text-fg-muted" />
              <div>
                <p className="type-admin font-medium text-fg">Background Jobs Engine</p>
                <p className="type-caption text-fg-muted">
                  Inngest cron dispatchers, alert scans & retention workers
                </p>
              </div>
            </div>
            <Badge tone={data.services.inngestConfigured ? 'success' : 'neutral'}>
              {data.services.inngestConfigured ? 'Connected' : 'Local Engine'}
            </Badge>
          </div>

          {/* Rate Limiter / Redis */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon icon={Shield} size={18} className="text-fg-muted" />
              <div>
                <p className="type-admin font-medium text-fg">Distributed Rate Limiting</p>
                <p className="type-caption text-fg-muted">
                  Upstash Redis sliding-window protection
                </p>
              </div>
            </div>
            <Badge tone={data.services.redisConfigured ? 'success' : 'neutral'}>
              {data.services.redisConfigured ? 'Upstash Redis' : 'In-Memory Fallback'}
            </Badge>
          </div>

          {/* Maintenance Mode */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon icon={Clock} size={18} className="text-fg-muted" />
              <div>
                <p className="type-admin font-medium text-fg">Storefront Maintenance Mode</p>
                <p className="type-caption text-fg-muted">
                  When enabled, public storefront serves 503 while staff console remains active
                </p>
              </div>
            </div>
            <Badge tone={data.services.maintenanceMode ? 'warning' : 'neutral'}>
              {data.services.maintenanceMode ? 'Active (503)' : 'Off (Live)'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
