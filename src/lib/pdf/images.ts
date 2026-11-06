import "server-only";

import sharp from "sharp";
import QRCode from "qrcode";
import type { PdfImage } from "@/lib/pdf/dossier/types";

/**
 * Bilder für PDFs: react-pdf unterstützt nur JPEG/PNG, die Varianten in Storage sind WebP.
 * Deshalb wird jedes Bild mit sharp nach JPEG konvertiert (EXIF-frei, begrenzte Grösse).
 */

export async function toPdfImage(
  input: Buffer,
  options: { maxWidth: number; quality: number; caption?: string | null; isAiVisualization?: boolean },
): Promise<PdfImage> {
  const pipeline = sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: options.maxWidth, height: options.maxWidth, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: options.quality, mozjpeg: true });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    data,
    format: "jpg",
    width: info.width,
    height: info.height,
    caption: options.caption?.trim() || null,
    isAiVisualization: options.isAiVisualization ?? false,
  };
}

/** Lädt eine Datei per HTTP mit Zeitlimit (z. B. Demo-Bilder von Unsplash). */
export async function fetchBinary(url: string, timeoutMs = 10_000): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 25 * 1024 * 1024) throw new Error("Bild zu gross");
  return Buffer.from(await response.arrayBuffer());
}

/** Führt Aufgaben mit begrenzter Parallelität aus; Fehler werden als null zurückgegeben. */
export async function mapSettledLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]!);
      } catch (error) {
        console.warn("[pdf] Bild übersprungen:", error instanceof Error ? error.message : error);
        results[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/** QR-Code als PNG (dunkelgrün auf weiss). */
export async function qrCodePng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#274B32", light: "#FFFFFF" },
  });
}
