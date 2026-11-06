/**
 * Bereitet Fotos im Browser für den Upload vor:
 * - grosse Fotos (> 3000 px) werden per Canvas verkleinert und als JPEG (Qualität 0.9) kodiert
 * - HEIC/HEIF wird – sofern der Browser es lesen kann (Safari) – in JPEG umgewandelt
 * - kleinere JPG/PNG/WebP werden unverändert hochgeladen (Original bleibt erhalten)
 * Die öffentlichen Versionen erzeugt danach der Server (ohne EXIF/GPS).
 */

export const CLIENT_MAX_DIMENSION = 3000;
export const CLIENT_JPEG_QUALITY = 0.9;
/** Grössere Dateien werden auch unter 3000 px neu kodiert, um den Upload klein zu halten. */
const RECOMPRESS_ABOVE_BYTES = 15 * 1024 * 1024;

export type UploadContentType = "image/jpeg" | "image/png" | "image/webp";

export interface PreparedUpload {
  blob: Blob;
  contentType: UploadContentType;
  width: number | null;
  height: number | null;
  resized: boolean;
}

export class UploadPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadPreparationError";
  }
}

const DIRECT_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp"]);
const HEIC_TYPES = new Set<string>(["image/heic", "image/heif"]);

export function detectImageType(file: File): string {
  const type = file.type.toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type) return type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "";
  }
}

export function isSupportedImage(file: File): boolean {
  const type = detectImageType(file);
  return DIRECT_TYPES.has(type) || HEIC_TYPES.has(type);
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function prepareUpload(
  file: File,
  options: { maxDimension?: number; quality?: number; maxBytes: number },
): Promise<PreparedUpload> {
  const maxDimension = options.maxDimension ?? CLIENT_MAX_DIMENSION;
  const quality = options.quality ?? CLIENT_JPEG_QUALITY;
  const type = detectImageType(file);
  const isHeic = HEIC_TYPES.has(type);
  if (!DIRECT_TYPES.has(type) && !isHeic) {
    throw new UploadPreparationError("Dieses Dateiformat wird nicht unterstützt. Bitte JPG, PNG, WebP oder HEIC verwenden.");
  }

  let decoded: DecodedImage;
  try {
    decoded = await decode(file);
  } catch {
    if (isHeic) {
      throw new UploadPreparationError(
        "HEIC-Fotos kann dieser Browser nicht umwandeln. Bitte speichern Sie das Foto als JPG oder laden Sie es mit Safari hoch.",
      );
    }
    if (file.size <= options.maxBytes) {
      // Der Server prüft und verarbeitet die Datei selbst.
      return { blob: file, contentType: type as UploadContentType, width: null, height: null, resized: false };
    }
    throw new UploadPreparationError("Die Datei konnte nicht gelesen werden.");
  }

  const longest = Math.max(decoded.width, decoded.height);
  const needsResize = longest > maxDimension;
  if (!isHeic && !needsResize && file.size <= RECOMPRESS_ABOVE_BYTES) {
    decoded.release();
    return { blob: file, contentType: type as UploadContentType, width: decoded.width, height: decoded.height, resized: false };
  }

  const scale = needsResize ? maxDimension / longest : 1;
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.release();
    throw new UploadPreparationError("Ihr Browser kann das Bild nicht verkleinern.");
  }
  // Weisser Hintergrund für transparente PNG, da JPEG keine Transparenz kennt
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.release();
  const blob = await canvasToBlob(canvas, quality);
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new UploadPreparationError("Das Bild konnte nicht verkleinert werden.");
  if (blob.size > options.maxBytes) throw new UploadPreparationError("Das Bild ist auch verkleinert noch grösser als erlaubt.");
  return { blob, contentType: "image/jpeg", width, height, resized: true };
}
