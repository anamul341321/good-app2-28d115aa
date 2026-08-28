/**
 * Client-side image compression so posts upload fast even on slow mobile data.
 * Falls back to the original file whenever anything goes wrong.
 */
export async function compressImage(
  file: File,
  maxSize = 1440,
  quality = 0.72,
): Promise<File> {
  try {
    if (typeof window === "undefined") return file;
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    if (file.size < 200 * 1024) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
