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

  let bitmap: ImageBitmap;
  try {
    // Preserve EXIF orientation (essential for mobile/camera photos)
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
  }

  try {
    const maxDim = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, MAX_EDGE / maxDim);

    // Maintain luxury visual fidelity: test 0.88, 0.82, 0.76.
    // If a file needs further size reduction, reduce scale smoothly rather than crushing quality.
    for (const quality of [0.88, 0.82, 0.76]) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d', { colorSpace: 'srgb' }) || canvas.getContext('2d');
      if (!context) break;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );

      if (blob && blob.type === 'image/webp' && blob.size <= SAFE_UPLOAD_BYTES) {
        return new File([blob], `${file.name.replace(/\.[A-Za-z0-9]+$/, '')}.webp`, {
          type: 'image/webp',
        });
      }

      // Step down resolution smoothly to 1920px max edge if still oversized
      scale = Math.min(scale, Math.min(1, 1920 / maxDim));
    }
  } catch {
    // An unreadable file is left as it is; the server reports it.
  } finally {
    bitmap.close();
  }

  return file;
}
