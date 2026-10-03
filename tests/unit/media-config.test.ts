import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('media configuration (ADR-026)', () => {
  it('has no Cloudinary variables left and documents the Blob token and local folder', () => {
    const example = read('.env.example');
    expect(example).not.toMatch(/CLOUDINARY/i);
    expect(example).toMatch(/^BLOB_READ_WRITE_TOKEN=$/m);
    expect(example).toMatch(/^MEDIA_LOCAL_DIR=$/m);
  });

  it('keeps the local media folder out of git, formatting, linting and the secret scan', () => {
    expect(read('.gitignore')).toMatch(/^\.local-media\/$/m);
    expect(read('.prettierignore')).toMatch(/^\.local-media$/m);
    expect(read('eslint.config.mjs')).toContain("'.local-media/**'");
    expect(read('scripts/secret-scan.mjs')).toContain('local-media');
  });

  it('keeps the development placeholders as SVG only under public/seed, never as an upload type', () => {
    expect(existsSync(path.join(root, 'public/seed'))).toBe(true);
    expect(read('src/lib/media/upload.ts')).not.toMatch(/image\/svg/);
  });

  it('allows product images from the Blob store host only', () => {
    const headers = read('src/lib/security/headers.ts');
    expect(headers).toContain('https://*.public.blob.vercel-storage.com');
    expect(headers).not.toMatch(/cloudinary/i);
  });
});
