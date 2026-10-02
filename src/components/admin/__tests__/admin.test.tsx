import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, isAdminNavActive, visibleAdminNav } from '@/lib/admin-nav';
import { ADMIN_THEME_INIT_SCRIPT, ADMIN_THEME_KEY, resolveTheme } from '@/lib/admin-theme';
import { PERMISSIONS } from '@/lib/permissions';
import { compareSortValues, DataTable, nextSort, type DataTableColumn } from '../data-table';
import { KpiCard } from '../kpi-card';
import { SaveStatusLine } from '../form-section';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

interface Row {
  id: string;
  name: string;
}
const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
];
const rows: Row[] = [
  { id: 'b', name: 'Bravo' },
  { id: 'a', name: 'Alpha' },
];

describe('sorting', () => {
  it('compares numbers, strings, bigints and missing values', () => {
    expect(compareSortValues(1, 2)).toBeLessThan(0);
    expect(compareSortValues('item 2', 'item 10')).toBeLessThan(0);
    expect(compareSortValues(5n, 3n)).toBeGreaterThan(0);
    expect(compareSortValues(null, 1)).toBeGreaterThan(0);
    expect(compareSortValues(1, undefined)).toBeLessThan(0);
    expect(compareSortValues(null, undefined)).toBe(0);
  });

  it('cycles ascending, descending, then off', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({ columnId: 'name', direction: 'asc' });
    const second = nextSort(first, 'name');
    expect(second).toEqual({ columnId: 'name', direction: 'desc' });
    expect(nextSort(second, 'name')).toBeNull();
    expect(nextSort(second, 'other')).toEqual({ columnId: 'other', direction: 'asc' });
  });
});

describe('DataTable', () => {
  it('is a named table with column headers and the rows in order', () => {
    const markup = html(
      <DataTable caption="Sample" columns={columns} rows={rows} getRowId={(r) => r.id} />,
    );
    expect(markup).toContain('<caption');
    expect(markup).toContain('Sample');
    expect(markup).toContain('scope="col"');
    expect(markup.indexOf('Bravo')).toBeLessThan(markup.indexOf('Alpha'));
  });

  it('offers sorting as a button and keeps the scroll region focusable', () => {
    const markup = html(
      <DataTable caption="Sample" columns={columns} rows={rows} getRowId={(r) => r.id} />,
    );
    expect(markup).toMatch(/<button[^>]*>Name/);
    expect(markup).toContain('tabindex="0"');
  });

  it('marks the sorted column for assistive tech', () => {
    const markup = html(
      <DataTable
        caption="Sample"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ columnId: 'name', direction: 'desc' }}
      />,
    );
    expect(markup).toContain('aria-sort="descending"');
  });

  it('adds selection checkboxes when selectable', () => {
    const markup = html(
      <DataTable
        caption="Sample"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectable
      />,
    );
    expect(markup).toContain('Select all rows');
    expect(markup).toContain('Select row a');
  });

  it('shows skeleton rows while loading and flags the region busy', () => {
    const markup = html(
      <DataTable
        caption="Sample"
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        status="loading"
        skeletonRows={2}
      />,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/animate-skeleton/g)?.length).toBe(2);
  });

  it('shows an empty state and an error state with a retry', () => {
    const empty = html(
      <DataTable caption="Sample" columns={columns} rows={[]} getRowId={(r) => r.id} />,
    );
    expect(empty).toContain('Nothing here yet');
    const error = html(
      <DataTable
        caption="Sample"
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        status="error"
        errorMessage="Could not load orders"
        onRetry={() => undefined}
      />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain('Could not load orders');
    expect(error).toContain('Try again');
  });

  it('only offers CSV export when a column can be exported', () => {
    const none = html(
      <DataTable
        caption="S"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        exportFilename="x"
      />,
    );
    expect(none).not.toContain('Export CSV');
    const some = html(
      <DataTable
        caption="S"
        columns={[{ ...columns[0]!, exportValue: (r) => r.name }]}
        rows={rows}
        getRowId={(r) => r.id}
        exportFilename="x"
      />,
    );
    expect(some).toContain('Export CSV');
  });
});

describe('KpiCard', () => {
  it('spells out the direction of a change, not only its colour', () => {
    const markup = html(
      <KpiCard
        label="Net sales"
        value="৳1,000"
        delta={{ value: '+4%', direction: 'up', tone: 'good' }}
      />,
    );
    expect(markup).toContain('Up');
    expect(markup).toContain('+4%');
  });

  it('has loading, error and empty states', () => {
    expect(html(<KpiCard label="Orders" value="" state="loading" />)).toContain('aria-busy="true"');
    expect(html(<KpiCard label="Orders" value="" state="error" />)).toContain('role="alert"');
    expect(html(<KpiCard label="Orders" value="" state="empty" />)).toContain('No value yet');
  });
});

describe('SaveStatusLine', () => {
  it.each([
    ['saved', 'All changes saved'],
    ['dirty', 'Unsaved changes'],
    ['saving', 'Saving'],
    ['error', 'Could not save'],
  ] as const)('announces %s politely', (status, text) => {
    const markup = html(<SaveStatusLine status={status} />);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain(text);
  });
});

describe('admin navigation', () => {
  it('hides screens the staff member lacks permission for', () => {
    const labels = (permissions: string[]) =>
      visibleAdminNav(permissions).flatMap((g) => g.items.map((i) => i.label));
    expect(labels([])).toEqual(['Dashboard', 'Style guide']);
    expect(labels(['orders.verify'])).toContain('Verification queue');
    expect(labels(['orders.read'])).not.toContain('Verification queue');
    expect(labels([...PERMISSIONS])).toContain('Audit log');
  });

  it('only gates items with permissions that exist', () => {
    for (const group of ADMIN_NAV) {
      for (const item of group.items) {
        if (item.permission) expect(PERMISSIONS).toContain(item.permission);
        expect(item.href.startsWith('/admin')).toBe(true);
      }
    }
  });

  it('never offers bulk or automatic confirmation of orders', () => {
    const text = JSON.stringify(ADMIN_NAV).toLowerCase();
    expect(text).not.toMatch(/bulk confirm|auto.?confirm|auto.?cancel/);
  });

  it('matches the dashboard exactly and other sections by prefix', () => {
    expect(isAdminNavActive('/admin', '/admin')).toBe(true);
    expect(isAdminNavActive('/admin/orders', '/admin')).toBe(false);
    expect(isAdminNavActive('/admin/orders/123', '/admin/orders')).toBe(true);
    expect(isAdminNavActive('/admin/ordersx', '/admin/orders')).toBe(false);
  });
});

describe('admin theme', () => {
  it('prefers a stored choice and otherwise follows the system', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('garbage', false)).toBe('light');
  });

  function runScript(stored: string | null, prefersDark: boolean) {
    const documentElement = { dataset: {} as Record<string, string> };
    runInNewContext(ADMIN_THEME_INIT_SCRIPT, {
      document: { documentElement },
      localStorage: { getItem: (key: string) => (key === ADMIN_THEME_KEY ? stored : null) },
      window: { matchMedia: () => ({ matches: prefersDark }) },
      matchMedia: () => ({ matches: prefersDark }),
    });
    return documentElement.dataset.theme;
  }

  it('the pre-paint script applies the same decision', () => {
    expect(runScript('dark', false)).toBe('dark');
    expect(runScript(null, true)).toBe('dark');
    expect(runScript(null, false)).toBe('light');
    expect(runScript('nonsense', false)).toBe('light');
  });

  it('the pre-paint script never throws when storage is unavailable', () => {
    const documentElement = { dataset: {} as Record<string, string> };
    expect(() =>
      runInNewContext(ADMIN_THEME_INIT_SCRIPT, {
        document: { documentElement },
        localStorage: {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        window: { matchMedia: () => ({ matches: false }) },
      }),
    ).not.toThrow();
    expect(documentElement.dataset.theme).toBe('light');
  });
});
