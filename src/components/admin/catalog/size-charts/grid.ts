/** Pure state for the size chart grid: measurement columns and size rows. */

export const MAX_COLUMNS = 8;
export const MAX_ROWS = 30;
export const MAX_CELL_LENGTH = 20;

export interface GridRow {
  /** Stable key for React, never sent to the server. */
  key: number;
  size: string;
  values: string[];
}

export interface GridState {
  columns: string[];
  rows: GridRow[];
  nextKey: number;
}

export type GridAction =
  | { type: 'addColumn' }
  | { type: 'removeColumn'; index: number }
  | { type: 'renameColumn'; index: number; name: string }
  | { type: 'addRow' }
  | { type: 'removeRow'; index: number }
  | { type: 'setSize'; index: number; size: string }
  | { type: 'setValue'; row: number; column: number; value: string };

export function createGrid(table?: {
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
}): GridState {
  if (!table || (table.columns.length === 0 && table.rows.length === 0)) {
    return {
      columns: ['Chest', 'Waist'],
      rows: [
        { key: 0, size: 'S', values: ['', ''] },
        { key: 1, size: 'M', values: ['', ''] },
      ],
      nextKey: 2,
    };
  }
  return {
    columns: [...table.columns],
    rows: table.rows.map((row, key) => ({
      key,
      size: row.size,
      // Every row always has one value per column, whatever was stored.
      values: table.columns.map((_, column) => row.values[column] ?? ''),
    })),
    nextKey: table.rows.length,
  };
}

const without = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);
const replaceAt = <T>(list: readonly T[], index: number, value: T): T[] =>
  list.map((item, i) => (i === index ? value : item));

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'addColumn':
      if (state.columns.length >= MAX_COLUMNS) return state;
      return {
        ...state,
        columns: [...state.columns, ''],
        rows: state.rows.map((row) => ({ ...row, values: [...row.values, ''] })),
      };
    case 'removeColumn':
      // A chart needs at least one measurement.
      if (state.columns.length <= 1 || !(action.index in state.columns)) return state;
      return {
        ...state,
        columns: without(state.columns, action.index),
        rows: state.rows.map((row) => ({ ...row, values: without(row.values, action.index) })),
      };
    case 'renameColumn':
      return { ...state, columns: replaceAt(state.columns, action.index, action.name) };
    case 'addRow':
      if (state.rows.length >= MAX_ROWS) return state;
      return {
        ...state,
        rows: [
          ...state.rows,
          { key: state.nextKey, size: '', values: state.columns.map(() => '') },
        ],
        nextKey: state.nextKey + 1,
      };
    case 'removeRow':
      if (state.rows.length <= 1) return state;
      return { ...state, rows: without(state.rows, action.index) };
    case 'setSize':
      return {
        ...state,
        rows: state.rows.map((row, i) =>
          i === action.index ? { ...row, size: action.size } : row,
        ),
      };
    case 'setValue':
      return {
        ...state,
        rows: state.rows.map((row, i) =>
          i === action.row
            ? { ...row, values: replaceAt(row.values, action.column, action.value) }
            : row,
        ),
      };
  }
}

/** The shape the server action expects (the schema trims the text). */
export function toTable(state: GridState): {
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
} {
  return {
    columns: state.columns,
    rows: state.rows.map((row) => ({ size: row.size, values: row.values })),
  };
}

/**
 * Turns server field paths ("rows.2.size", "columns.0", "rows") into readable lines such as
 * "Row 3: Size is required", so problems inside the grid are never colour-only.
 */
export function gridErrorLines(
  errors: Record<string, string[]>,
  columns: readonly string[],
): string[] {
  const lines: string[] = [];
  for (const [path, messages] of Object.entries(errors)) {
    const [head, first, kind, second] = path.split('.');
    let prefix: string | null = null;
    if (head === 'columns') {
      prefix = first === undefined ? null : `Measurement ${Number(first) + 1}`;
    } else if (head === 'rows') {
      if (first !== undefined) {
        const column =
          kind === 'values' && second !== undefined ? columns[Number(second)] : undefined;
        prefix = `Row ${Number(first) + 1}${column ? `, ${column}` : ''}`;
      }
    } else {
      continue;
    }
    for (const message of messages) lines.push(prefix ? `${prefix}: ${message}` : message);
  }
  return lines;
}

/** Whether one cell has a server error, for aria-invalid on the input. */
export const cellHasError = (errors: Record<string, string[]>, path: string): boolean =>
  Boolean(errors[path]?.length);
