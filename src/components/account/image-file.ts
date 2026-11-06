import { IMAGE_ACTION_MAX_BYTES, IMAGE_SOURCE_MAX_BYTES, IMAGE_UPLOAD_TYPES } from "@/lib/validation/account";

/**
 * Bereitet ein Bild im Browser für den Upload über eine Server Action vor:
 * verkleinert es (max. Kantenlänge) und kodiert es neu, damit es unter dem
 * Limit der Server Actions bleibt. Die endgültige Verarbeitung (Zuschnitt,
 * WebP, Entfernen von Metadaten) erfolgt serverseitig mit sharp.
 */
export class ImagePreparationError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImagePreparationError("encode"))), type, quality);
  });
}

async function encode(bitmap: ImageBitmap, maxSize: number, type: string, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImagePreparationError("canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return canvasToBlob(canvas, type, quality);
}

export async function prepareImageForUpload(
  file: File,
  options: { maxSize: number; preferTransparency?: boolean },
): Promise<Blob> {
  if (file.size > IMAGE_SOURCE_MAX_BYTES) {
    throw new ImagePreparationError("Die Datei ist zu gross. Bitte wählen Sie ein Bild bis 20 MB.");
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Format kann vom Browser nicht gelesen werden (z. B. HEIC in Chrome)
    if ((IMAGE_UPLOAD_TYPES as readonly string[]).includes(file.type) && file.size <= IMAGE_ACTION_MAX_BYTES) return file;
    throw new ImagePreparationError(
      "Dieses Bildformat kann Ihr Browser nicht verarbeiten. Bitte wählen Sie ein JPG-, PNG- oder WebP-Bild.",
    );
  }
  try {
    const attempts: Array<{ size: number; type: string; quality: number }> = options.preferTransparency
      ? [
          { size: options.maxSize, type: "image/webp", quality: 0.92 },
          { size: options.maxSize, type: "image/png", quality: 1 },
          { size: Math.round(options.maxSize / 2), type: "image/png", quality: 1 },
          { size: Math.round(options.maxSize / 2), type: "image/jpeg", quality: 0.85 },
        ]
      : [
          { size: options.maxSize, type: "image/jpeg", quality: 0.9 },
          { size: options.maxSize, type: "image/jpeg", quality: 0.75 },
          { size: Math.round(options.maxSize / 2), type: "image/jpeg", quality: 0.8 },
        ];
    for (const attempt of attempts) {
      const blob = await encode(bitmap, attempt.size, attempt.type, attempt.quality);
      if (blob.size <= IMAGE_ACTION_MAX_BYTES) return blob;
    }
    throw new ImagePreparationError("Das Bild ist zu gross. Bitte wählen Sie ein kleineres Bild.");
  } finally {
    bitmap.close();
  }
}

export function imagePreparationMessage(error: unknown): string {
  if (error instanceof ImagePreparationError && error.message.length > 12) return error.message;
  return "Das Bild konnte nicht verarbeitet werden. Bitte versuchen Sie es mit einer anderen Datei.";
}
