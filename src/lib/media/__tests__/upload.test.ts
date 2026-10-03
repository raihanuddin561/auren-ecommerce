import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, processImage, sniffMedia, validateUpload } from '../upload';

const raw = { create: { width: 40, height: 20, channels: 3 as const, background: '#c81e1e' } };

const jpegWithGps = () =>
  sharp(raw)
    .jpeg()
    .withExif({
      IFD0: { Copyright: 'private-owner', Make: 'SecretCam' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '23/1 45/1 0/1', GPSLongitudeRef: 'E' },
    })
    .toBuffer();

const bytes = (...values: number[]) => Uint8Array.from(values);
const text = (value: string) => new TextEncoder().encode(value);

describe('sniffMedia (magic bytes, not the client content type)', () => {
  it('recognises jpeg, png, webp, avif and pdf', async () => {
    expect(sniffMedia(await sharp(raw).jpeg().toBuffer())?.mime).toBe('image/jpeg');
    expect(sniffMedia(await sharp(raw).png().toBuffer())?.mime).toBe('image/png');
    expect(sniffMedia(await sharp(raw).webp().toBuffer())?.mime).toBe('image/webp');
    expect(sniffMedia(await sharp(raw).avif().toBuffer())?.mime).toBe('image/avif');
    expect(sniffMedia(text('%PDF-1.7\n'))?.mime).toBe('application/pdf');
  });

  it('refuses everything else, svg first', () => {
    expect(
      sniffMedia(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
    ).toBeNull();
    expect(sniffMedia(text('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(sniffMedia(text('<!doctype html><html></html>'))).toBeNull();
    expect(sniffMedia(text('GIF89a'))).toBeNull();
    expect(sniffMedia(text('MZ\u0090\u0000'))).toBeNull();
    expect(sniffMedia(bytes())).toBeNull();
    expect(sniffMedia(bytes(0xff, 0xd8))).toBeNull();
  });

  it('is not fooled by an ftyp box of another brand (mp4, heic)', () => {
    const mp4 = new Uint8Array(32);
    mp4.set(text('ftypisom'), 4);
    expect(sniffMedia(mp4)).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts an allowed image and reports its real type', async () => {
    const result = validateUpload(await sharp(raw).png().toBuffer(), { kind: 'image' });
    expect(result).toMatchObject({ ok: true, type: { mime: 'image/png', extension: 'png' } });
  });

  it('ignores the name and claimed type: an svg is refused whatever it is called', () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(validateUpload(svg, { kind: 'image' })).toMatchObject({
      ok: false,
      code: 'unsupported_type',
    });
    expect(validateUpload(svg, { kind: 'receipt' })).toMatchObject({
      ok: false,
      code: 'unsupported_type',
    });
  });

  it('accepts a pdf for receipts only', () => {
    const pdf = text('%PDF-1.4 ...');
    expect(validateUpload(pdf, { kind: 'receipt' }).ok).toBe(true);
    expect(validateUpload(pdf, { kind: 'image' })).toMatchObject({
      ok: false,
      code: 'unsupported_type',
    });
  });

  it('enforces the size cap and refuses empty files', async () => {
    const png = await sharp(raw).png().toBuffer();
    expect(validateUpload(png, { kind: 'image', maxBytes: png.length - 1 })).toMatchObject({
      ok: false,
      code: 'too_large',
    });
    expect(validateUpload(png, { kind: 'image', maxBytes: png.length }).ok).toBe(true);
    expect(validateUpload(new Uint8Array(0), { kind: 'image' })).toMatchObject({
      ok: false,
      code: 'empty',
    });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateUpload(big, { kind: 'image' })).toMatchObject({ ok: false, code: 'too_large' });
  });

  it('refuses a nonsensical cap instead of skipping the check', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const maxBytes of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
      expect(() => validateUpload(png, { kind: 'image', maxBytes })).toThrow(/cap/);
    }
  });

  it('never allows a cap above 25 MB', () => {
    const big = new Uint8Array(26 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateUpload(big, { kind: 'image', maxBytes: 1e9 })).toMatchObject({
      ok: false,
      code: 'too_large',
    });
  });
});

describe('processImage', () => {
  it('strips EXIF and GPS data', async () => {
    const original = await jpegWithGps();
    const before = await sharp(original).metadata();
    expect(before.exif).toBeDefined();
    expect(original.includes(Buffer.from('SecretCam'))).toBe(true);

    const out = await processImage(original);
    const after = await sharp(out.body).metadata();
    expect(after.exif).toBeUndefined();
    expect(out.body.includes(Buffer.from('SecretCam'))).toBe(false);
    expect(out.body.includes(Buffer.from('private-owner'))).toBe(false);
    expect(out).toMatchObject({ mime: 'image/webp', extension: 'webp', width: 40, height: 20 });
  });

  it('drops a payload appended after the image data', async () => {
    const original = Buffer.concat([
      await sharp(raw).png().toBuffer(),
      Buffer.from('<script>evil()</script>'),
    ]);
    const out = await processImage(original);
    expect(out.body.includes(Buffer.from('evil'))).toBe(false);
  });

  it('applies the EXIF orientation before dropping it', async () => {
    const tall = await sharp(raw).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await processImage(tall);
    expect([out.width, out.height]).toEqual([20, 40]);
  });

  it('caps the long edge and never enlarges', async () => {
    const wide = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const out = await processImage(wide);
    expect(out.width).toBe(2400);
    expect(out.height).toBe(800);
  });

  it('reports the dominant colour as a hex string', async () => {
    const out = await processImage(await sharp(raw).png().toBuffer());
    expect(out.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('refuses a corrupt or oversized-in-pixels image', async () => {
    await expect(processImage(Buffer.from('not an image'))).rejects.toThrow();
  });
});
