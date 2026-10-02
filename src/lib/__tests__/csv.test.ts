import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from '../csv';

describe('escapeCsvCell', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvCell('Linen shirt')).toBe('Linen shirt');
    expect(escapeCsvCell(1299)).toBe('1299');
    expect(escapeCsvCell(10n)).toBe('10');
  });

  it('writes empty cells for null and undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises spreadsheet formulas in text', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(escapeCsvCell('+8801700000000')).toBe("'+8801700000000");
    expect(escapeCsvCell('-1+1')).toBe("'-1+1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('keeps genuine negative numbers numeric', () => {
    expect(escapeCsvCell(-250)).toBe('-250');
  });
});

describe('toCsv', () => {
  it('builds a BOM-prefixed CRLF document', () => {
    const csv = toCsv(
      ['Order', 'Total'],
      [
        ['A-1', '৳1,299.00'],
        ['A-2', 0],
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual(['﻿Order,Total', 'A-1,"৳1,299.00"', 'A-2,0', '']);
  });
});
