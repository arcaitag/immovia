import "server-only";

import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { fetchBinary } from "@/lib/pdf/images";
import type { DbClient } from "@/services/ai/db";

export interface ImageSourceRow {
  id: string;
  property_id: string;
  original_path: string | null;
  base_path: string | null;
  display_path: string | null;
  external_url: string | null;
}

export const IMAGE_SOURCE_COLUMNS = "id, property_id, original_path, base_path, display_path, external_url";

async function decodable(buffer: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buffer).metadata();
    return Boolean(meta.width && meta.height);
  } catch {
    return false;
  }
}

/**
 * Lädt die beste verfügbare Quelle eines Bildes für die Bearbeitung:
 * 1. Original-Upload (privat), 2. unveränderte Basisversion (lg), 3. Demo-Bild (Unsplash).
 * Bearbeitet wird immer ausgehend vom Original, nie von einer bereits optimierten Version.
 */
export async function loadImageSource(client: DbClient, image: ImageSourceRow): Promise<{ buffer: Buffer; origin: "original" | "base" | "external" }> {
  if (image.original_path) {
    const { data } = await client.storage.from("property-originals").download(image.original_path);
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      if (await decodable(buffer)) return { buffer, origin: "original" };
    }
  }
  if (image.base_path) {
    const { data } = await client.storage.from("property-images").download(`${image.base_path}-lg.webp`);
    if (data) return { buffer: Buffer.from(await data.arrayBuffer()), origin: "base" };
  }
  if (image.external_url) {
    try {
      return { buffer: await fetchBinary(`${image.external_url.split("?")[0]}?w=2048&q=90&fm=jpg&fit=max`, 15_000), origin: "external" };
    } catch {
      throw new AppError("service_unavailable", "Das Bild konnte nicht geladen werden. Bitte versuchen Sie es später erneut.");
    }
  }
  throw new AppError("not_found", "Für dieses Bild ist keine Originaldatei vorhanden.");
}
