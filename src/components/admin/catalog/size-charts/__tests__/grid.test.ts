import { describe, expect, it } from 'vitest';
import {
  createGrid,
  gridErrorLines,
  gridReducer,
  MAX_COLUMNS,
  MAX_ROWS,
  toTable,
  type GridState,
} from '../grid';

const start = (): GridState =>
  createGrid({
    columns: ['Chest', 'Waist'],
    rows: [
      { size: 'S', values: ['90-94', '76-80'] },
      { size: 'M', values: ['96-100'] },
    ],
  });

describe('size chart grid', () => {
  it('pads rows so every size has one value per measurement', () => {
    expect(start().rows[1]!.values).toEqual(['96-100', '']);
  });

  it('starts with a small template when there is no chart yet', () => {
    const grid = createGrid();
    expect(grid.columns.length).toBeGreaterThan(0);
    expect(grid.rows.every((r) => r.values.length === grid.columns.length)).toBe(true);
  });

  it('adds a column to every row and removes it again', () => {
    const added = gridReducer(start(), { type: 'addColumn' });
    expect(added.columns).toHaveLength(3);
    expect(added.rows.every((r) => r.values.length === 3)).toBe(true);
    const removed = gridReducer(added, { type: 'removeColumn', index: 0 });
    expect(removed.columns).toEqual(['Waist', '']);
    expect(removed.rows[0]!.values).toEqual(['76-80', '']);
  });

  it('keeps at least one column and one row', () => {
    let grid = createGrid({ columns: ['Chest'], rows: [{ size: 'S', values: ['1'] }] });
    grid = gridReducer(grid, { type: 'removeColumn', index: 0 });
    grid = gridReducer(grid, { type: 'removeRow', index: 0 });
    expect(grid.columns).toHaveLength(1);
    expect(grid.rows).toHaveLength(1);
  });

  it('respects the column and row limits', () => {
    let grid = start();
    for (let i = 0; i < 20; i++) grid = gridReducer(grid, { type: 'addColumn' });
    expect(grid.columns).toHaveLength(MAX_COLUMNS);
    for (let i = 0; i < 40; i++) grid = gridReducer(grid, { type: 'addRow' });
    expect(grid.rows).toHaveLength(MAX_ROWS);
  });

  it('gives new rows unique keys even after removing rows', () => {
    let grid = start();
    grid = gridReducer(grid, { type: 'removeRow', index: 0 });
    grid = gridReducer(grid, { type: 'addRow' });
    grid = gridReducer(grid, { type: 'addRow' });
    expect(new Set(grid.rows.map((r) => r.key)).size).toBe(grid.rows.length);
  });

  it('edits names, sizes and values', () => {
    let grid = start();
    grid = gridReducer(grid, { type: 'renameColumn', index: 1, name: 'Hip' });
    grid = gridReducer(grid, { type: 'setSize', index: 0, size: 'XS' });
    grid = gridReducer(grid, { type: 'setValue', row: 0, column: 1, value: '70' });
    expect(toTable(grid)).toEqual({
      columns: ['Chest', 'Hip'],
      rows: [
        { size: 'XS', values: ['90-94', '70'] },
        { size: 'M', values: ['96-100', ''] },
      ],
    });
  });
});

describe('grid error lines', () => {
  it('describes errors by row and measurement', () => {
    const lines = gridErrorLines(
      {
        'rows.2.size': ['Size is required'],
        'rows.0.values.1': ['Too long'],
        columns: ['Too many'],
        rows: ['Sizes must be different'],
        name: ['ignored here'],
      },
      ['Chest', 'Waist'],
    );
    expect(lines).toEqual([
      'Row 3: Size is required',
      'Row 1, Waist: Too long',
      'Too many',
      'Sizes must be different',
    ]);
  });
});
