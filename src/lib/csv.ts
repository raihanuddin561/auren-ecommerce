/**
 * CSV export helpers for admin tables.
 *
 * Cells that begin with = + - @ (or a tab/carriage return) are prefixed with an apostrophe so a
 * spreadsheet never evaluates customer-supplied text as a formula (CSV injection).
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  // CRLF is what spreadsheet tools expect; the BOM keeps Excel from mangling UTF-8 (for example ৳).
  return `﻿${lines.join('\r\n')}\r\n`;
}
