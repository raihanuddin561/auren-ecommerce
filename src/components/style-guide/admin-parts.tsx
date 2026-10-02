'use client';

import { useState } from 'react';
import { FormActions, FormSection } from '@/components/admin/form-section';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { KpiCard } from '@/components/admin/kpi-card';
import { PageHeader } from '@/components/admin/page-header';
import { SidebarNav } from '@/components/admin/shell/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PERMISSIONS } from '@/lib/permissions';
import { GuideGroup, GuideSection } from './guide-section';

interface SampleOrder {
  id: string;
  customer: string;
  items: number;
  total: string;
  totalMinor: number;
  status: 'Awaiting verification' | 'Confirmed' | 'On hold';
}

// Sample rows only: nothing here comes from the database.
const ROWS: SampleOrder[] = [
  {
    id: 'AU-10482',
    customer: 'Ayaan Rahman',
    items: 2,
    total: '৳6,450',
    totalMinor: 645000,
    status: 'Awaiting verification',
  },
  {
    id: 'AU-10481',
    customer: 'Tahmid Hasan',
    items: 1,
    total: '৳2,990',
    totalMinor: 299000,
    status: 'Confirmed',
  },
  {
    id: 'AU-10480',
    customer: 'Rafi Chowdhury',
    items: 3,
    total: '৳11,200',
    totalMinor: 1120000,
    status: 'On hold',
  },
  {
    id: 'AU-10479',
    customer: 'Imran Khan',
    items: 1,
    total: '৳1,890',
    totalMinor: 189000,
    status: 'Awaiting verification',
  },
];

const STATUS_TONE = {
  'Awaiting verification': 'warning',
  Confirmed: 'success',
  'On hold': 'outline',
} as const;

const COLUMNS: DataTableColumn<SampleOrder>[] = [
  {
    id: 'order',
    header: 'Order',
    cell: (row) => <span className="font-medium text-fg">{row.id}</span>,
    sortValue: (row) => row.id,
    exportValue: (row) => row.id,
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: (row) => row.customer,
    sortValue: (row) => row.customer,
    exportValue: (row) => row.customer,
  },
  {
    id: 'items',
    header: 'Items',
    cell: (row) => row.items,
    sortValue: (row) => row.items,
    align: 'end',
    hideBelow: 'md',
  },
  {
    id: 'total',
    header: 'Total',
    cell: (row) => row.total,
    sortValue: (row) => row.totalMinor,
    exportValue: (row) => row.total,
    align: 'end',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
    exportValue: (row) => row.status,
  },
];

const getRowId = (row: SampleOrder) => row.id;

export function AdminPartsSection() {
  const [name, setName] = useState('AUREN');
  return (
    <GuideSection
      id="admin"
      title="Admin console"
      description="Calm, dense and consistent. Sans headings, 14px body, light and dark."
    >
      <GuideGroup label="Page header" className="block">
        <PageHeader
          className="mb-0"
          titleAs="h3"
          title="Orders"
          description="Everything waiting for a person to check it."
          breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Orders' }]}
          actions={
            <>
              <Button variant="secondary" size="sm">
                Export
              </Button>
              <Button size="sm">New order</Button>
            </>
          }
        />
      </GuideGroup>

      <GuideGroup label="KPI cards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Net sales"
          value="৳4,82,300"
          delta={{ value: '+12.4%', direction: 'up', tone: 'good', comparedTo: 'vs last week' }}
        />
        <KpiCard
          label="Return rate"
          value="3.1%"
          delta={{ value: '+0.6 pts', direction: 'up', tone: 'bad', comparedTo: 'vs last week' }}
        />
        <KpiCard
          label="Orders"
          value="184"
          delta={{ value: '0%', direction: 'flat' }}
          footnote="Last 7 days"
        />
        <KpiCard label="Average order value" value="" state="loading" />
        <KpiCard
          label="Conversion"
          value=""
          state="error"
          stateMessage="Analytics is not reachable."
        />
      </GuideGroup>

      <GuideGroup label="Data table: sortable, selectable, exportable" className="block">
        <DataTable
          caption="Sample orders"
          columns={COLUMNS}
          rows={ROWS}
          getRowId={getRowId}
          selectable
          exportFilename="sample-orders"
          bulkActions={(selected) => (
            <Button variant="secondary" size="sm">
              Print {selected.length} packing {selected.length === 1 ? 'slip' : 'slips'}
            </Button>
          )}
        />
      </GuideGroup>

      <GuideGroup label="Data table: loading, empty, error" className="grid gap-6">
        <DataTable
          caption="Loading orders"
          columns={COLUMNS}
          rows={[]}
          getRowId={getRowId}
          status="loading"
          skeletonRows={3}
          density="compact"
        />
        <DataTable caption="No orders" columns={COLUMNS} rows={[]} getRowId={getRowId} />
        <DataTable
          caption="Orders that failed to load"
          columns={COLUMNS}
          rows={[]}
          getRowId={getRowId}
          status="error"
          onRetry={() => undefined}
        />
      </GuideGroup>

      <GuideGroup label="Form section and actions" className="block">
        <FormSection
          title="Store details"
          description="Shown on invoices, packing slips and in the storefront footer."
        >
          <FormField label="Store name">
            {(control) => (
              <Input {...control} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </FormField>
          <FormField label="Support phone" error="Enter a valid phone number">
            {(control) => <Input {...control} defaultValue="017" />}
          </FormField>
          <Switch label="Show the concierge button" defaultChecked />
        </FormSection>
        <div className="relative mt-4 border border-line">
          <FormActions status={name === 'AUREN' ? 'saved' : 'dirty'}>
            <Button variant="secondary" size="sm">
              Discard
            </Button>
            <Button size="sm">Save changes</Button>
          </FormActions>
        </div>
      </GuideGroup>

      <GuideGroup label="Sidebar navigation (all permissions)" className="block">
        <div className="w-64 border border-line bg-raised p-3">
          <SidebarNav permissions={PERMISSIONS} label="Sidebar preview" />
        </div>
      </GuideGroup>
    </GuideSection>
  );
}
