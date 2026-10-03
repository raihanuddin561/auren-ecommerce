/**
 * Server Actions on Vercel accept request bodies up to about 4.5 MB, while the editorial standard
 * allows source images of up to 10 MB. Larger files are therefore shrunk in the browser (WebP, long
 * edge at most 2400 px) before they are sent. The server still validates and re-encodes every
 * upload, so this is only a courtesy that keeps big camera files working.
 */
export const SAFE_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2400;

export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= SAFE_UPLOAD_BYTES) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.type === 'image/webp' && blob.size <= SAFE_UPLOAD_BYTES) {
        bitmap.close();
        return new File([blob], `${file.name.replace(/\.[A-Za-z0-9]+$/, '')}.webp`, {
          type: 'image/webp',
        });
      }
      scale *= 0.85;
    }
    bitmap.close();
  } catch {
    // An unreadable file is left as it is; the server reports it.
  }
  return file;
}
