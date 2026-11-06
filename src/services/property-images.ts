import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SessionUser } from "@/lib/auth/session";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { AppError, fromDbError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES, cropImage, processImage, variantPaths, type ProcessedImage } from "@/lib/images/processing";
import { isUuid } from "@/lib/utils";
import { loadManagedProperty } from "@/services/properties";
import { getPublishingSettings } from "@/services/listings";

/**
 * Bildverwaltung (Schritt 3). Ablauf beim Upload:
 * 1. createUploadTargets: signierte Upload-URLs für property-originals/{property}/{image}.{ext}
 * 2. Browser lädt die (verkleinerte) Datei direkt in den Storage (mit Fortschritt)
 * 3. processUploadedImage: Original laden, Varianten mit sharp erzeugen (ohne EXIF/GPS),
 *    nach property-images/{property}/{image}/base-{sm|md|lg}.webp schreiben, Zeile anlegen.
 */

export const IMAGE_COLUMNS =
  "id, property_id, display_path, base_path, original_path, external_url, width, height, size_bytes, sort_order, is_cover, caption, is_floor_plan, is_enhanced, is_ai_visualization, status, created_at" as const;

export type UploadExtension = "jpg" | "png" | "webp";

export const UPLOAD_CONTENT_TYPES: Record<UploadExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionForContentType(contentType: string): UploadExtension | null {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export interface UploadTarget {
  imageId: string;
  ext: UploadExtension;
  contentType: string;
  path: string;
  signedUrl: string;
}

async function imageRows(supabase: ServerSupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("property_images")
    .select(IMAGE_COLUMNS)
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export type PropertyImageRow = Awaited<ReturnType<typeof imageRows>>[number];

export async function listPropertyImages(supabase: ServerSupabaseClient, propertyId: string): Promise<PropertyImageRow[]> {
  return imageRows(supabase, propertyId);
}

async function countImages(supabase: ServerSupabaseClient, propertyId: string): Promise<number> {
  const { count, error } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if (error) throw fromDbError(error);
  return count ?? 0;
}

export async function createUploadTargets(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  files: { contentType: string; size: number }[],
): Promise<UploadTarget[]> {
  await loadManagedProperty(supabase, user, propertyId);
  const [existing, settings] = await Promise.all([countImages(supabase, propertyId), getPublishingSettings(supabase)]);
  const remaining = Math.max(0, settings.maxImages - existing);
  if (files.length > remaining) {
    throw new AppError(
      "validation",
      remaining === 0
        ? `Sie haben die maximale Anzahl von ${settings.maxImages} Bildern erreicht.`
        : `Sie können noch ${remaining} von maximal ${settings.maxImages} Bildern hochladen.`,
    );
  }

  return Promise.all(
    files.map(async (file) => {
      const ext = extensionForContentType(file.contentType);
      if (!ext) throw new AppError("validation", "Bitte laden Sie JPG-, PNG- oder WebP-Bilder hoch.");
      if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
        throw new AppError("validation", "Ein Bild ist grösser als 25 MB.");
      }
      const imageId = randomUUID();
      const path = `${propertyId}/${imageId}.${ext}`;
      const { data, error } = await supabase.storage.from("property-originals").createSignedUploadUrl(path, { upsert: true });
      if (error || !data) {
        console.error("[bilder] Signierte Upload-URL fehlgeschlagen", error?.message);
        throw new AppError("forbidden", "Der Upload konnte nicht vorbereitet werden.");
      }
      return { imageId, ext, contentType: UPLOAD_CONTENT_TYPES[ext], path, signedUrl: data.signedUrl };
    }),
  );
}

async function uploadVariants(supabase: ServerSupabaseClient, prefix: string, processed: ProcessedImage): Promise<void> {
  const paths = variantPaths(prefix);
  const results = await Promise.all(
    (Object.keys(paths) as (keyof typeof paths)[]).map((size) =>
      supabase.storage.from("property-images").upload(paths[size], processed.variants[size], {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      }),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("[bilder] Variante konnte nicht gespeichert werden", failed.error.message);
    throw new AppError("unknown", "Das Bild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
  }
}

async function removeVariants(supabase: ServerSupabaseClient, prefix: string): Promise<void> {
  const paths = Object.values(variantPaths(prefix));
  const { error } = await supabase.storage.from("property-images").remove(paths);
  if (error) console.error("[bilder] Varianten konnten nicht entfernt werden", error.message);
}

async function downloadOriginal(supabase: ServerSupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from("property-originals").download(path);
  if (error || !data) {
    throw new AppError("not_found", "Die hochgeladene Datei wurde nicht gefunden. Bitte laden Sie das Bild erneut hoch.");
  }
  if (data.size > MAX_UPLOAD_BYTES) {
    throw new AppError("validation", "Das Bild ist grösser als 25 MB.");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function processUploadedImage(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  input: { propertyId: string; imageId: string; ext: UploadExtension },
): Promise<PropertyImageRow> {
  await loadManagedProperty(supabase, user, input.propertyId);
  const originalPath = `${input.propertyId}/${input.imageId}.${input.ext}`;

  const { data: existing } = await supabase.from("property_images").select(IMAGE_COLUMNS).eq("id", input.imageId).maybeSingle();
  if (existing) {
    if (existing.property_id !== input.propertyId) throw new AppError("conflict");
    return existing;
  }

  const discardOriginal = async () => {
    await supabase.storage.from("property-originals").remove([originalPath]);
  };

  const [count, settings] = await Promise.all([countImages(supabase, input.propertyId), getPublishingSettings(supabase)]);
  if (count >= settings.maxImages) {
    await discardOriginal();
    throw new AppError("validation", `Sie haben die maximale Anzahl von ${settings.maxImages} Bildern erreicht.`);
  }

  let original: Buffer;
  try {
    original = await downloadOriginal(supabase, originalPath);
  } catch (cause) {
    await discardOriginal();
    throw cause;
  }

  let processed: ProcessedImage;
  try {
    processed = await processImage(original);
  } catch (cause) {
    console.error("[bilder] Verarbeitung fehlgeschlagen", cause instanceof Error ? cause.message : cause);
    await discardOriginal();
    throw new AppError("validation", "Die Datei konnte nicht als Bild gelesen werden. Bitte verwenden Sie JPG, PNG oder WebP.");
  }

  const prefix = `${input.propertyId}/${input.imageId}/base`;
  await uploadVariants(supabase, prefix, processed);

  const [lastRes, coverRes] = await Promise.all([
    supabase
      .from("property_images")
      .select("sort_order")
      .eq("property_id", input.propertyId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("property_images").select("id").eq("property_id", input.propertyId).eq("is_cover", true).maybeSingle(),
  ]);

  const { data, error } = await supabase
    .from("property_images")
    .insert({
      id: input.imageId,
      property_id: input.propertyId,
      original_path: originalPath,
      base_path: prefix,
      display_path: prefix,
      width: processed.width,
      height: processed.height,
      size_bytes: original.byteLength,
      mime_type: UPLOAD_CONTENT_TYPES[input.ext],
      sort_order: (lastRes.data?.sort_order ?? -1) + 1,
      is_cover: !coverRes.data,
      status: "ready",
    })
    .select(IMAGE_COLUMNS)
    .single();
  if (error || !data) {
    await removeVariants(supabase, prefix);
    await discardOriginal();
    throw fromDbError(error);
  }
  return data;
}

async function loadManagedImage(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<PropertyImageRow> {
  if (!isUuid(imageId)) throw new AppError("not_found", "Das Bild wurde nicht gefunden.");
  const { data, error } = await supabase.from("property_images").select(IMAGE_COLUMNS).eq("id", imageId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("not_found", "Das Bild wurde nicht gefunden.");
  await loadManagedProperty(supabase, user, data.property_id);
  return data;
}

export async function updateImageDetails(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  imageId: string,
  patch: { caption?: string | null; is_floor_plan?: boolean },
): Promise<PropertyImageRow> {
  await loadManagedImage(supabase, user, imageId);
  const { data, error } = await supabase.from("property_images").update(patch).eq("id", imageId).select(IMAGE_COLUMNS).single();
  if (error || !data) throw fromDbError(error);
  return data;
}

export async function setCoverImage(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<PropertyImageRow> {
  const image = await loadManagedImage(supabase, user, imageId);
  if (image.status !== "ready") throw new AppError("invalid_state", "Das Bild ist noch nicht bereit.");
  const { data, error } = await supabase.from("property_images").update({ is_cover: true }).eq("id", imageId).select(IMAGE_COLUMNS).single();
  if (error || !data) throw fromDbError(error);
  return data;
}

export async function reorderImages(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  orderedIds: string[],
): Promise<void> {
  await loadManagedProperty(supabase, user, propertyId);
  const rows = await imageRows(supabase, propertyId);
  const known = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== rows.length || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !known.has(id))) {
    throw new AppError("conflict", "Die Bilder wurden inzwischen geändert. Bitte laden Sie die Seite neu.");
  }
  const current = new Map(rows.map((r) => [r.id, r.sort_order]));
  const changes = orderedIds
    .map((id, index) => ({ id, sort_order: index }))
    .filter((change) => current.get(change.id) !== change.sort_order);
  const results = await Promise.all(
    changes.map((change) => supabase.from("property_images").update({ sort_order: change.sort_order }).eq("id", change.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw fromDbError(failed.error);
}

export async function deleteImage(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<{ propertyId: string }> {
  const image = await loadManagedImage(supabase, user, imageId);
  const { error } = await supabase.from("property_images").delete().eq("id", imageId);
  if (error) throw fromDbError(error);

  // Alle Versionen des Bildes (Basis, Zuschnitte, Optimierungen) liegen im Ordner {property}/{image}/
  const folder = `${image.property_id}/${image.id}`;
  const { data: files } = await supabase.storage.from("property-images").list(folder, { limit: 1000 });
  const paths = (files ?? []).map((file) => `${folder}/${file.name}`);
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from("property-images").remove(paths);
    if (removeError) console.error("[bilder] Dateien konnten nicht entfernt werden", removeError.message);
  }
  if (image.original_path) {
    const { error: originalError } = await supabase.storage.from("property-originals").remove([image.original_path]);
    if (originalError) console.error("[bilder] Original konnte nicht entfernt werden", originalError.message);
  }

  if (image.is_cover) {
    const { data: next } = await supabase
      .from("property_images")
      .select("id")
      .eq("property_id", image.property_id)
      .eq("status", "ready")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("property_images").update({ is_cover: true }).eq("id", next.id);
  }
  return { propertyId: image.property_id };
}

/**
 * Zuschneiden: arbeitet immer auf dem Original (Prozentwerte → Pixel des gedrehten
 * Originals), erzeugt neue Varianten crop-{zeitstempel}-… und setzt nur display_path.
 * base_path bleibt unverändert (vom Trigger geschützt).
 */
export async function cropPropertyImage(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  imageId: string,
  area: { x: number; y: number; width: number; height: number },
): Promise<PropertyImageRow> {
  const image = await loadManagedImage(supabase, user, imageId);
  if (!image.original_path) throw new AppError("invalid_state", "Für dieses Bild ist kein Original gespeichert.");
  if (image.is_ai_visualization) throw new AppError("invalid_state", "KI-Visualisierungen können nicht zugeschnitten werden.");

  const original = await downloadOriginal(supabase, image.original_path);
  const meta = await sharp(original).metadata();
  const width = meta.autoOrient?.width ?? meta.width;
  const height = meta.autoOrient?.height ?? meta.height;
  if (!width || !height) throw new AppError("validation", "Die Bildgrösse konnte nicht gelesen werden.");

  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const x = clamp(area.x);
  const y = clamp(area.y);
  const pixelArea = {
    x: Math.round((x / 100) * width),
    y: Math.round((y / 100) * height),
    width: Math.round((Math.min(clamp(area.width), 100 - x) / 100) * width),
    height: Math.round((Math.min(clamp(area.height), 100 - y) / 100) * height),
  };

  let processed: ProcessedImage;
  try {
    processed = await processImage(await cropImage(original, pixelArea));
  } catch (cause) {
    const message = cause instanceof Error && cause.message.includes("zu klein") ? "Der Ausschnitt ist zu klein." : "Das Bild konnte nicht zugeschnitten werden.";
    throw new AppError("validation", message);
  }

  const prefix = `${image.property_id}/${image.id}/crop-${Date.now()}`;
  await uploadVariants(supabase, prefix, processed);
  const { data, error } = await supabase
    .from("property_images")
    .update({ display_path: prefix, width: processed.width, height: processed.height, is_enhanced: false })
    .eq("id", imageId)
    .select(IMAGE_COLUMNS)
    .single();
  if (error || !data) {
    await removeVariants(supabase, prefix);
    throw fromDbError(error);
  }
  const previous = image.display_path;
  if (previous && previous !== prefix && previous.startsWith(`${image.property_id}/${image.id}/crop-`)) {
    await removeVariants(supabase, previous);
  }
  return data;
}

/** Setzt den Zuschnitt zurück (Anzeige wieder aus der Basisversion). */
export async function resetImageCrop(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<PropertyImageRow> {
  const image = await loadManagedImage(supabase, user, imageId);
  if (!image.base_path) throw new AppError("invalid_state");
  const { data, error } = await supabase
    .from("property_images")
    .update({ display_path: image.base_path, is_enhanced: false })
    .eq("id", imageId)
    .select(IMAGE_COLUMNS)
    .single();
  if (error || !data) throw fromDbError(error);
  if (image.display_path && image.display_path.startsWith(`${image.property_id}/${image.id}/crop-`)) {
    await removeVariants(supabase, image.display_path);
  }
  return data;
}
