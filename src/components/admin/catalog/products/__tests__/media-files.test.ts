import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES,
  MAX_MEDIA_PER_PRODUCT,
  canUpload,
  selectFiles,
  validateImageFile,
} from '../media-files';

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('validateImageFile', () => {
  it('accepts JPEG, PNG, WebP and AVIF', () => {
    for (const [name, type] of [
      ['a.jpg', 'image/jpeg'],
      ['a.png', 'image/png'],
      ['a.webp', 'image/webp'],
      ['a.avif', 'image/avif'],
    ] as const) {
      expect(validateImageFile(file(name, type))).toBeNull();
    }
  });

  it('never accepts SVG, by type or by extension', () => {
    expect(validateImageFile(file('a.svg', 'image/svg+xml'))).toMatch(/SVG/);
    expect(validateImageFile(file('a.svg', ''))).toMatch(/SVG/);
  });

  it('falls back to the extension when the browser gives no type', () => {
    expect(validateImageFile(file('look.AVIF', ''))).toBeNull();
    expect(validateImageFile(file('notes.pdf', ''))).toMatch(/JPEG, PNG, WebP or AVIF/);
    expect(validateImageFile(file('a.gif', 'image/gif'))).not.toBeNull();
  });

  it('enforces the 10 MB limit and refuses empty files', () => {
    expect(validateImageFile(file('a.jpg', 'image/jpeg', MAX_FILE_BYTES))).toBeNull();
    expect(validateImageFile(file('a.jpg', 'image/jpeg', MAX_FILE_BYTES + 1))).toMatch(/10 MB/);
    expect(validateImageFile(file('a.jpg', 'image/jpeg', 0))).toMatch(/empty/);
  });
});

describe('selectFiles', () => {
  it('keeps valid files and explains the others', () => {
    const { accepted, rejected } = selectFiles(
      [file('a.jpg', 'image/jpeg'), file('b.svg', 'image/svg+xml')],
      0,
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg']);
    expect(rejected).toEqual([{ name: 'b.svg', reason: expect.stringMatching(/SVG/) }]);
  });

  it('stops at the per-product limit, counting existing and waiting images', () => {
    const many = Array.from({ length: 5 }, (_, i) => file(`${i}.jpg`, 'image/jpeg'));
    const { accepted, rejected } = selectFiles(many, MAX_MEDIA_PER_PRODUCT - 4, 1);
    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]?.reason).toMatch(String(MAX_MEDIA_PER_PRODUCT));
  });
});

describe('canUpload', () => {
  it('needs a file, and alt text on every file that is waiting', () => {
    expect(canUpload([])).toBe(false);
    expect(canUpload([{ alt: 'Front view', state: 'ready' }])).toBe(true);
    expect(canUpload([{ alt: '  ', state: 'ready' }])).toBe(false);
    expect(
      canUpload([
        { alt: 'Front', state: 'ready' },
        { alt: '', state: 'ready' },
      ]),
    ).toBe(false);
  });

  it('is off while a file is uploading, and lets failed files be retried', () => {
    expect(canUpload([{ alt: 'a', state: 'uploading' }])).toBe(false);
    expect(canUpload([{ alt: 'a', state: 'error' }])).toBe(true);
  });
});
