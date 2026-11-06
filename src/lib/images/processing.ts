import "server-only";

import sharp, { type Sharp } from "sharp";

/**
 * Bildverarbeitung mit sharp (serverseitig, ohne externe KI).
 * - Varianten sm/md/lg als WebP, automatisch gedreht, Metadaten (EXIF/GPS) entfernt.
 * - Korrekturen: Helligkeit, Kontrast, Sättigung, Belichtung, Weissabgleich,
 *   Schärfe, Begradigen (Drehen mit automatischem Zuschnitt), Auto-Tonwert.
 * Perspektivkorrektur und virtuelle Möblierung benötigen einen Bild-KI-Anbieter.
 */

export const IMAGE_VARIANTS = { sm: 640, md: 1280, lg: 2048 } as const;
export type ImageVariant = keyof typeof IMAGE_VARIANTS;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export interface Adjustments {
  /** -0.5 … 0.5 (0 = unverändert) */
  brightness?: number;
  /** -0.5 … 0.5 */
  contrast?: number;
  /** -0.5 … 0.5 */
  saturation?: number;
  /** -0.5 … 0.5, multiplikative Belichtung */
  exposure?: number;
  /** -1 … 1, negativ = kühler, positiv = wärmer */
  warmth?: number;
  /** Automatischer Weissabgleich (Gray-World) */
  autoWhiteBalance?: boolean;
  /** Automatische Tonwertkorrektur (1/99-Perzentil) */
  autoLevels?: boolean;
  /** 0 … 1 */
  sharpen?: number;
  /** -15 … 15 Grad */
  straighten?: number;
}

export interface ProcessedImage {
  variants: Record<ImageVariant, Buffer>;
  width: number;
  height: number;
}

function clamp(value: number | undefined, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

/** Prüft die Signatur der Datei (nicht nur den MIME-Typ des Browsers). */
export async function inspectImage(input: Buffer): Promise<{ format: string; width: number; height: number }> {
  const meta = await sharp(input, { failOn: "error" }).metadata();
  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif"].includes(meta.format)) {
    throw new Error("Nicht unterstütztes Bildformat");
  }
  if (!meta.width || !meta.height) throw new Error("Bildgrösse konnte nicht gelesen werden");
  if (meta.width * meta.height > 80_000_000) throw new Error("Das Bild ist zu gross");
  return { format: meta.format, width: meta.width, height: meta.height };
}

/** Gray-World-Weissabgleich: Faktoren je Kanal aus den Mittelwerten. */
async function grayWorldFactors(input: Buffer): Promise<[number, number, number]> {
  const stats = await sharp(input).rotate().resize(256, 256, { fit: "inside" }).removeAlpha().stats();
  const means = stats.channels.slice(0, 3).map((c) => c.mean);
  const [r = 128, g = 128, b = 128] = means;
  const gray = (r + g + b) / 3;
  const limit = (f: number) => Math.min(1.35, Math.max(0.75, f));
  return [limit(gray / r), limit(gray / g), limit(gray / b)];
}

/** Vorschlag für automatische Optimierung anhand von Bildstatistiken. */
export async function suggestAdjustments(input: Buffer): Promise<Adjustments> {
  const stats = await sharp(input).rotate().resize(512, 512, { fit: "inside" }).removeAlpha().greyscale().stats();
  const channel = stats.channels[0];
  const mean = channel?.mean ?? 128;
  const stdev = channel?.stdev ?? 50;
  const brightness = mean < 110 ? Math.min(0.25, (120 - mean) / 260) : mean > 170 ? -Math.min(0.15, (mean - 160) / 300) : 0;
  const contrast = stdev < 45 ? Math.min(0.2, (55 - stdev) / 120) : 0;
  return {
    autoLevels: true,
    autoWhiteBalance: true,
    brightness: Number(brightness.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    saturation: 0.06,
    sharpen: 0.3,
  };
}

async function buildPipeline(input: Buffer, adjustments: Adjustments): Promise<Sharp> {
  let pipeline = sharp(input, { failOn: "error" }).rotate();

  const angle = clamp(adjustments.straighten, -15, 15);
  if (angle !== 0) {
    const meta = await sharp(input).rotate().metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const rad = (Math.abs(angle) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const scale = Math.min(w / (w * cos + h * sin), h / (w * sin + h * cos));
    const cropW = Math.floor(w * scale);
    const cropH = Math.floor(h * scale);
    const boundW = Math.round(w * cos + h * sin);
    const boundH = Math.round(w * sin + h * cos);
    const rotated = await pipeline.rotate(angle, { background: { r: 255, g: 255, b: 255 } }).toBuffer();
    pipeline = sharp(rotated).extract({
      left: Math.max(0, Math.floor((boundW - cropW) / 2)),
      top: Math.max(0, Math.floor((boundH - cropH) / 2)),
      width: Math.min(cropW, boundW),
      height: Math.min(cropH, boundH),
    });
  }

  if (adjustments.autoLevels) {
    pipeline = pipeline.normalise({ lower: 1, upper: 99 });
  }

  let [rf, gf, bf] = [1, 1, 1];
  if (adjustments.autoWhiteBalance) {
    [rf, gf, bf] = await grayWorldFactors(input);
  }
  const warmth = clamp(adjustments.warmth, -1, 1);
  if (warmth !== 0) {
    rf *= 1 + warmth * 0.08;
    bf *= 1 - warmth * 0.08;
  }
  if (rf !== 1 || gf !== 1 || bf !== 1) {
    pipeline = pipeline.recomb([
      [rf, 0, 0],
      [0, gf, 0],
      [0, 0, bf],
    ]);
  }

  const contrast = clamp(adjustments.contrast, -0.5, 0.5);
  const exposure = clamp(adjustments.exposure, -0.5, 0.5);
  if (contrast !== 0 || exposure !== 0) {
    const a = (1 + contrast) * (1 + exposure);
    const b = 128 * (1 - (1 + contrast)) * (1 + exposure);
    pipeline = pipeline.linear(a, b);
  }

  const brightness = clamp(adjustments.brightness, -0.5, 0.5);
  const saturation = clamp(adjustments.saturation, -0.5, 0.5);
  if (brightness !== 0 || saturation !== 0) {
    pipeline = pipeline.modulate({ brightness: 1 + brightness, saturation: 1 + saturation });
  }

  const sharpen = clamp(adjustments.sharpen, 0, 1);
  if (sharpen > 0) {
    pipeline = pipeline.sharpen({ sigma: 0.6 + sharpen * 1.2 });
  }
  return pipeline;
}

/**
 * Erzeugt die Web-Varianten eines Bildes (optional mit Korrekturen).
 * Ergebnis ist ohne Metadaten (kein EXIF/GPS).
 */
export async function processImage(input: Buffer, adjustments: Adjustments = {}): Promise<ProcessedImage> {
  await inspectImage(input);
  const base = await (await buildPipeline(input, adjustments)).toColourspace("srgb").toBuffer();
  const meta = await sharp(base).metadata();

  const entries = await Promise.all(
    (Object.entries(IMAGE_VARIANTS) as [ImageVariant, number][]).map(async ([variant, width]) => {
      const buffer = await sharp(base)
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: variant === "sm" ? 76 : 82, effort: 4 })
        .toBuffer();
      return [variant, buffer] as const;
    }),
  );

  return {
    variants: Object.fromEntries(entries) as Record<ImageVariant, Buffer>,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

/** Zuschneiden (Koordinaten in Pixeln des automatisch gedrehten Originals). */
export async function cropImage(
  input: Buffer,
  area: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  const rotated = await sharp(input).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const left = Math.max(0, Math.round(area.x));
  const top = Math.max(0, Math.round(area.y));
  const width = Math.min(Math.round(area.width), (meta.width ?? 0) - left);
  const height = Math.min(Math.round(area.height), (meta.height ?? 0) - top);
  if (width < 50 || height < 50) throw new Error("Der Ausschnitt ist zu klein");
  return sharp(rotated).extract({ left, top, width, height }).jpeg({ quality: 95 }).toBuffer();
}

/** Speicherpfade der Varianten: {prefix}-sm.webp usw. */
export function variantPaths(prefix: string): Record<ImageVariant, string> {
  return { sm: `${prefix}-sm.webp`, md: `${prefix}-md.webp`, lg: `${prefix}-lg.webp` };
}
